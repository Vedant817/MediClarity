import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { similaritySearch, deleteNamespace } from "@/lib/embeddings";
import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { aiModelConfig } from "@/lib/ai/model-config";
import { buildChatSystemPrompt, buildRetrievedContextPrompt } from "@/lib/ai/prompts";
import { getUserVectorNamespace, isValidSessionId } from "@/lib/security/session";

const chatSessions: Record<string, ChatSession> = {};

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        const { sessionId, userMessage, endSession } = await req.json();

        if (!isValidSessionId(sessionId) || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const namespace = getUserVectorNamespace(userId, sessionId);

        if (endSession) {
            await deleteNamespace(namespace);
            if (chatSessions[namespace]) {
                delete chatSessions[namespace];
            }
            return NextResponse.json({ status: "Session ended" });
        }

        let chat = chatSessions[namespace];
        if (!chat) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
                const model = await genAI.getGenerativeModel({ model: aiModelConfig.chatModel });

                const systemPrompt = buildChatSystemPrompt();

                chat = await model.startChat({
                    history: [
                        { role: "user", parts: [{ text: "I need help understanding my medical reports" }] },
                        { role: "model", parts: [{ text: "I'm your AI Medical Assistant. I have access to your medical information and can help you understand your reports. What would you like to know about your medical data?" }] }
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        topP: 0.8,
                        topK: 40,
                    }
                });

                await chat.sendMessage(systemPrompt);

                chatSessions[namespace] = chat;
            } catch (initError) {
                console.error("Failed to recreate chat session:", initError);
                return NextResponse.json(
                    { reply: "Your session has expired. Please refresh the page to start a new conversation." },
                    { status: 404 }
                );
            }
        }

        if (!userMessage || !userMessage.trim()) {
            return NextResponse.json(
                { reply: "I didn't receive a message. How can I help you with your medical information?" }
            );
        }

        let similarDocs = [];
        try {
            similarDocs = await similaritySearch(userMessage, namespace, aiModelConfig.retrievalTopK);
        } catch (searchError) {
            console.error("Error searching for similar documents:", searchError);
            return NextResponse.json(
                { reply: "I'm having trouble accessing your medical information right now. Please try asking again." }
            );
        }

        const contextPrompt = buildRetrievedContextPrompt(similarDocs);
        await chat.sendMessage(contextPrompt);

        try {
            const result = await chat.sendMessage(userMessage);
            const reply = result.response.text();
            return NextResponse.json({ reply });
        } catch (modelError) {
            console.error("Error from AI model:", modelError);
            delete chatSessions[namespace];
            return NextResponse.json(
                { reply: "I'm sorry, I'm having trouble accessing your medical information right now. Please try asking again." }
            );
        }

    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json(
            { reply: "I'm having trouble responding right now. Please try again." }
        );
    }
}