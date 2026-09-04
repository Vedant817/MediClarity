import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Conversation from "@/models/conversation";

const conversationKind = "records-chat";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, summary, ocr } = await req.json();
    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 128) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    await connectDB();
    const conversation = await Conversation.findOneAndUpdate(
      { userId, kind: conversationKind, sessionId },
      {
        $set: {
          context: {
            summary: typeof summary === "string" ? summary.slice(0, 200_000) : "",
            ocr: typeof ocr === "string" ? ocr.slice(0, 500_000) : "",
          },
        },
        $setOnInsert: { userId, kind: conversationKind, sessionId, messages: [] },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // The report context is persisted with the Clerk-owned conversation so
    // records chat remains restart-safe without a second data processor.
    const dataStatus = typeof summary === "string" && summary.trim()
      ? "context_saved"
      : typeof ocr === "string" && ocr.trim()
        ? "context_saved"
        : "no_data";

    return NextResponse.json({
      status: "Session initialized",
      dataStatus,
      conversationId: conversation._id,
      messages: conversation.messages,
    });
  } catch (error) {
    console.error("Error initializing session:", error);
    return NextResponse.json({ error: "Failed to initialize session" }, { status: 500 });
  }
}
