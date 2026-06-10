import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteNamespace, embedDocuments } from "@/lib/embeddings";
import { normalizeReportText } from "@/lib/ai/validation";
import { chunkText } from "@/lib/ai/chunking";
import { getUserVectorNamespace, isValidSessionId } from "@/lib/security/session";
import connectDB from "@/lib/db";
import Report from "@/models/report";

function createReportChunks({
    userId,
    sessionId,
    reportId,
    summary,
    ocr,
}: {
    userId: string;
    sessionId: string;
    reportId: string;
    summary: string;
    ocr: string;
}) {
    const baseMetadata = {
        userId,
        sessionId,
        reportId,
        timestamp: new Date().toISOString(),
    };

    const chunks: { text: string; metadata: Record<string, unknown> & { userId: string } }[] = [];

    chunkText(summary).forEach((chunk, index) => {
        chunks.push({
            text: `MEDICAL SUMMARY SOURCE ${index + 1}: ${chunk}`,
            metadata: { ...baseMetadata, type: "summary", chunkIndex: index, priority: "high" },
        });
    });

    chunkText(ocr).forEach((chunk, index) => {
        chunks.push({
            text: `OCR REPORT SOURCE ${index + 1}: ${chunk}`,
            metadata: { ...baseMetadata, type: "ocr", chunkIndex: index },
        });
    });

    const overview = `PATIENT MEDICAL OVERVIEW:\nSUMMARY:\n${summary}\n\nREPORT EXCERPT:\n${ocr.slice(0, 1200)}${ocr.length > 1200 ? "..." : ""}`;
    chunks.push({
        text: overview,
        metadata: { ...baseMetadata, type: "overview", chunkIndex: 0, priority: "high" },
    });

    return chunks;
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        const { sessionId } = await req.json();

        if (!isValidSessionId(sessionId) || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await connectDB();
        const report = await Report.findOne({ userId }).sort({ createdAt: -1 });

        if (!report) {
            return NextResponse.json({ error: "No report found" }, { status: 404 });
        }

        const summary = normalizeReportText(report.summary);
        const ocr = normalizeReportText(report.ocr);

        if (!summary || !ocr) {
            return NextResponse.json({ error: "Report has no searchable content" }, { status: 422 });
        }

        const namespace = getUserVectorNamespace(userId, sessionId);
        const chunks = createReportChunks({
            userId,
            sessionId,
            reportId: String(report._id),
            summary,
            ocr,
        });

        try {
            await deleteNamespace(namespace);
            await embedDocuments(chunks, namespace);
        } catch (embedError) {
            console.error("Failed to create embeddings:", embedError);
            return NextResponse.json(
                { error: "Failed to prepare report context", dataStatus: "embedding_failed" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            status: "Session initialized",
            dataStatus: "data_embedded",
            reportId: String(report._id),
            chunkCount: chunks.length,
        });
    } catch (error) {
        console.error("Error initializing session:", error);
        return NextResponse.json(
            { error: "Failed to initialize session" },
            { status: 500 }
        );
    }
}
