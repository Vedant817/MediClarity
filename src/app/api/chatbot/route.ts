import { GoogleGenerativeAI } from "@google/generative-ai";
import { embedDocuments, similaritySearch, deleteNamespace } from "@/lib/embeddings";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const chatSessions: Record<string, any> = {};

export async function POST(req: Request) {
    const { sessionId, userId, summary, ocr, messages, endSession } = await req.json();

    if (endSession && sessionId) {
        await deleteNamespace(sessionId);
        return Response.json({ status: "Session ended" });
    }

    if (!sessionId || !userId || !summary || !messages) {
        return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    const latestUserMessage = messages[messages.length - 1].content;
    const chat = chatSessions[sessionId] ?? await genAI.getGenerativeModel({ model: "gemini-1.5-pro" }).startChat({ history: [] });

    if (!chatSessions[sessionId]) {
        const chunks = [
            { text: summary, metadata: { type: "summary", userId } },
            { text: ocr, metadata: { type: "ocr", userId } },
            ...messages.filter(m => m.role === "user").map((m, i) => ({
                text: m.content,
                metadata: { type: "chat", order: i },
            })),
        ];
        await embedDocuments(chunks, sessionId);
        chatSessions[sessionId] = chat;
    }

    const similarDocs = await similaritySearch(latestUserMessage, sessionId, 5);

    const context = similarDocs.length > 0
        ? `Relevant info from your medical history:\n\n${similarDocs.join("\n\n")}`
        : "No relevant info found in prior data.";

    const fullPrompt = `${context}\n\nUser asked: ${latestUserMessage}`;

    const result = await chat.sendMessage(fullPrompt);
    const reply = result.response.text();

    return Response.json({ reply });
}
