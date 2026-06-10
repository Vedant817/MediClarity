import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { aiModelConfig } from "@/lib/ai/model-config";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import { normalizeReportText } from "@/lib/ai/validation";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const chatSessions: Record<string, ChatSession> = {};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionId, messages } = body;
        const summary = normalizeReportText(body.summary);
        const ocr = normalizeReportText(body.ocr);

        if (!sessionId || !summary || !ocr || !messages) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let chat = chatSessions[sessionId];
        if (!chat) {
            const model = genAI.getGenerativeModel({ model: aiModelConfig.chatModel });

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
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.8,
                    topK: 40,
                },
            });

            await chat.sendMessage(buildChatSystemPrompt());
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
