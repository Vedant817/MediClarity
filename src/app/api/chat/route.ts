import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const chatSessions: Record<string, ChatSession> = {};

export async function POST(req: NextRequest) {
    try {
        const { sessionId, summary, ocr, messages } = await req.json();
        if (!sessionId || !summary || !ocr || !messages) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let chat = chatSessions[sessionId];
        if (!chat) {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

            chat = await model.startChat({
                history: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: `Here is the medical summary:\n\n${summary}`,
                            },
                            {
                                text: `Additionally, here is the OCR text:\n\n${ocr}`,
                            },
                        ],
                    },
                ],
            });

            await chat.sendMessage(
                `You are a highly knowledgeable and friendly medical assistant.
                
                Your task is to help the user understand the provided medical report (summary + OCR). When answering:
                
                1. If the user's question relates to something directly mentioned in the summary or OCR, answer using only that information.
                2. If the topic is mentioned but not explained in detail, give a general explanation using your broader medical knowledge. Clearly say the report does not include specific details.
                3. If the question is unrelated to the report but still medical, you may answer with general medical knowledge in a helpful and supportive tone.
                
                💡 Important:
                - Never say "I can't answer" or "There’s not enough info." Instead, give the best answer you can based on the report or general knowledge.
                - Keep your answers simple, clear, and easy for non-medical users to understand.
                - Use bullet points, steps, or lists whenever possible to break down complex ideas.
                - Do not make assumptions. If something is not in the report, say so clearly.
                
                Your goal is to help the user understand medical information with confidence and clarity.`
            );
            chatSessions[sessionId] = chat;
        }

        const latestMessage = messages[messages.length - 1]?.content;
        if (!latestMessage) {
            return NextResponse.json({ error: "Missing user message" }, { status: 400 });
        }

        const result = await chat.sendMessage(latestMessage);
        const reply = result.response.text();

        return NextResponse.json({ reply });
    } catch (err) {
        console.error("Chat error:", err);
        return NextResponse.json({ error: "Chat failed" }, { status: 500 });
    }
}