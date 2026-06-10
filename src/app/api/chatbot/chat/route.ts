import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { deleteNamespace } from "@/lib/embeddings";
import { aiModelConfig } from "@/lib/ai/model-config";
import { getUserVectorNamespace, isValidSessionId } from "@/lib/security/session";
import { buildRagAnswerPrompt, retrieveRagContext, type ChatHistoryMessage } from "@/lib/rag";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function normalizeUserMessage(value: unknown) {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().slice(0, aiModelConfig.maxChatMessageCharacters);
}

function normalizeHistory(value: unknown): ChatHistoryMessage[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((message): message is ChatHistoryMessage => {
            if (!message || typeof message !== "object") return false;
            const candidate = message as Partial<ChatHistoryMessage>;
            return (candidate.role === "user" || candidate.role === "assistant")
                && typeof candidate.content === "string";
        })
        .slice(-8)
        .map((message) => ({
            role: message.role,
            content: message.content.slice(0, aiModelConfig.maxChatMessageCharacters),
        }));
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        const body = await req.json();
        const { sessionId, endSession } = body;

        if (!isValidSessionId(sessionId) || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const namespace = getUserVectorNamespace(userId, sessionId);

        if (endSession) {
            await deleteNamespace(namespace);
            return NextResponse.json({ status: "Session ended" });
        }

        const userMessage = normalizeUserMessage(body.userMessage);
        if (!userMessage) {
            return NextResponse.json(
                { reply: "I didn't receive a message. How can I help you with your medical report?" },
                { status: 400 }
            );
        }

        const history = normalizeHistory(body.messages);
        const context = await retrieveRagContext(userMessage, namespace);
        const prompt = buildRagAnswerPrompt({
            question: userMessage,
            context,
            history,
        });

        const model = genAI.getGenerativeModel({ model: aiModelConfig.chatModel });
        const result = await model.generateContent(prompt);
        const reply = result.response.text();

        return NextResponse.json({
            reply,
            sources: context.sources.map(({ id, sourceType, score, chunkIndex, reportId }) => ({
                id,
                sourceType,
                score,
                chunkIndex,
                reportId,
            })),
            confidence: context.confidence,
            mode: context.mode,
        });
    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json(
            { reply: "I'm having trouble responding right now. Please try again." },
            { status: 500 }
        );
    }
}
