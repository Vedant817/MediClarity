import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { embedDocuments } from "@/lib/embeddings";
import { aiModelConfig } from "@/lib/ai/model-config";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import { normalizeReportText } from "@/lib/ai/validation";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const chatSessions: Record<string, ChatSession> = {};

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        const body = await req.json();
        const { sessionId } = body;
        const summary = normalizeReportText(body.summary);
        const ocr = normalizeReportText(body.ocr);

        if (!sessionId || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (chatSessions[sessionId]) {
            delete chatSessions[sessionId];
        }

        const model = await genAI.getGenerativeModel({ model: aiModelConfig.chatModel });

        const systemPrompt = buildChatSystemPrompt();

        const chat = await model.startChat({
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

        const chunks = [];

        const baseMetadata = {
            userId,
            sessionId,
            timestamp: new Date().toISOString()
        };

        if (summary && summary.trim()) {
            chunks.push({
                text: `MEDICAL SUMMARY: ${summary}`,
                metadata: { ...baseMetadata, type: "summary" }
            });
        }

        if (ocr && ocr.trim()) {
            chunks.push({
                text: `MEDICAL REPORT OCR TEXT: ${ocr}`,
                metadata: { ...baseMetadata, type: "ocr" }
            });
        }

        if (chunks.length > 0) {
            const overviewText = `
PATIENT MEDICAL OVERVIEW:
${summary ? `\nSUMMARY: ${summary}` : ''}
${ocr ? `\nREPORT DETAILS: ${ocr.substring(0, 1000)}${ocr.length > 1000 ? '...' : ''}` : ''}
`;
            chunks.push({
                text: overviewText,
                metadata: { ...baseMetadata, type: "overview", priority: "high" }
            });
        }

        let dataStatus = "no_data";
        if (chunks.length > 0) {
            try {
                await embedDocuments(chunks, sessionId);
                dataStatus = "data_embedded";
                console.log(`Created ${chunks.length} embeddings for session ${sessionId}`);
            } catch (embedError) {
                console.error("Failed to create embeddings:", embedError);
                dataStatus = "embedding_failed";
            }
        }

        return NextResponse.json({
            status: "Session initialized",
            dataStatus: dataStatus
        });

    } catch (error) {
        console.error("Error initializing session:", error);
        return NextResponse.json(
            { error: "Failed to initialize session" },
            { status: 500 }
        );
    }
}