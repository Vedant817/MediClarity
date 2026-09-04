import { auth } from "@clerk/nextjs/server";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getLLM, llmContentToText } from "@/lib/llm";
import Conversation, { IMessage } from "@/models/conversation";

export const runtime = "nodejs";

const conversationKind = "records-chat";
const disclaimer = "For information only, not medical advice. A qualified clinician should interpret these results in your full clinical context.";
const systemPrompt = `You are a health information assistant, not a doctor.
Answer patient-specific questions only from the medical-record context supplied with the message.
If the requested information is absent, say exactly: "Not in report - ask your doctor".
Never diagnose, prescribe, recommend changing treatment, or invent findings.
Explain terms in simple language and distinguish general education from facts present in the records.
End every response with this exact disclaimer: "${disclaimer}"`;

function toLangChainHistory(messages: IMessage[]) {
  return messages.slice(-20).map((message) =>
    message.role === "assistant"
      ? new AIMessage(message.content)
      : new HumanMessage(message.content),
  );
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, userMessage, endSession } = await req.json();
    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 128) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectDB();
    const conversation = await Conversation.findOne({
      userId,
      kind: conversationKind,
      sessionId,
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (endSession) {
      return NextResponse.json({ status: "Session ended" });
    }

    if (typeof userMessage !== "string" || !userMessage.trim()) {
      return NextResponse.json({ error: "Missing user message" }, { status: 400 });
    }

    const summary = conversation.context?.summary?.trim();
    const ocr = conversation.context?.ocr?.trim();
    const recordContext = [
      summary ? `MEDICAL SUMMARY:\n${summary}` : "",
      ocr ? `MEDICAL REPORT OCR TEXT:\n${ocr.slice(0, 100_000)}` : "",
    ].filter(Boolean).join("\n\n") || "No report context was saved for this conversation.";

    const model = getLLM("chat");
    const result = await model.invoke([
      new SystemMessage(systemPrompt),
      ...toLangChainHistory(conversation.messages),
      new HumanMessage(
        `MEDICAL-RECORD CONTEXT:\n${recordContext}\n\nUSER QUESTION:\n${userMessage.trim()}`,
      ),
    ]);
    let reply = llmContentToText(result.content).trim();
    if (!reply) {
      throw new Error("AI provider returned an empty records-chat response");
    }
    if (!reply.includes(disclaimer)) {
      reply = `${reply}\n\n${disclaimer}`;
    }

    const timestamp = new Date();
    await Conversation.updateOne(
      { _id: conversation._id, userId },
      {
        $push: {
          messages: {
            $each: [
              { role: "user", content: userMessage.trim(), timestamp },
              { role: "assistant", content: reply, timestamp },
            ],
          },
        },
        $set: { updatedAt: timestamp },
      }
    );

    return NextResponse.json({ reply, conversationId: conversation._id });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Chat failed", reply: "I'm having trouble responding right now. Please try again." },
      { status: 500 }
    );
  }
}
