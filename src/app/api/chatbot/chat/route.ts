import { NextResponse } from "next/server";
import { similaritySearch, deleteNamespace } from "@/lib/embeddings";
import { GoogleGenerativeAI } from "@google/generative-ai";

const chatSessions: Record<string, any> = {};

export async function POST(req: Request) {
    try {
        const { sessionId, userId, userMessage, endSession } = await req.json();

        if (endSession && sessionId) {
            await deleteNamespace(sessionId);
            if (chatSessions[sessionId]) {
                delete chatSessions[sessionId];
            }
            return NextResponse.json({ status: "Session ended" });
        }

        if (!sessionId || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let chat = chatSessions[sessionId];
        if (!chat) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
                const model = await genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

                const systemPrompt = `
You are an AI Medical Assistant that helps patients understand their medical reports.
Important: The user has already uploaded their medical data. You DO have access to the patient's medical information through the vector database.
Each time a user asks a question, you'll be provided with relevant information extracted from their medical records.
Always acknowledge that you have their data and answer based on the specific medical context provided.
Never say you don't have access to their medical information.
Explain medical terms in simple language and be specific to their personal medical context.
`;

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

                chatSessions[sessionId] = chat;
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
            similarDocs = await similaritySearch(userMessage, sessionId, 5);
        } catch (searchError) {
            console.error("Error searching for similar documents:", searchError);
            return NextResponse.json(
                { reply: "I'm having trouble accessing your medical information right now. Please try asking again." }
            );
        }

        let contextPrompt = "";
        if (similarDocs && similarDocs.length > 0) {
            contextPrompt = `
I have access to your medical records. Here is the relevant information from your medical history related to your question:

${similarDocs.join("\n\n")}

Using this information to respond to your question...
`;
        } else {
            contextPrompt = `
I have access to your medical records, but couldn't find specific information related to your question. I'll provide general medical information instead.
`;
        }

        await chat.sendMessage(contextPrompt);

        try {
            const result = await chat.sendMessage(userMessage);
            const reply = result.response.text();
            return NextResponse.json({ reply });
        } catch (modelError) {
            console.error("Error from AI model:", modelError);
            delete chatSessions[sessionId];
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