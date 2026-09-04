import { auth } from "@clerk/nextjs/server";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getLLM, llmContentToText } from "@/lib/llm";
import Conversation, { IMessage } from "@/models/conversation";

export const runtime = "nodejs";

const conversationKind = "report-chat";
const disclaimer = "For information only, not medical advice. A qualified clinician should interpret these results in your full clinical context.";

const systemPrompt = `You are a health information assistant, not a doctor.
Use the supplied report summary and OCR text as the only source for patient-specific claims.
If the requested information is absent, say exactly: "Not in report - ask your doctor".
You may explain a medical term in general, but clearly distinguish general information from report content.
Never diagnose, prescribe, recommend changing treatment, or claim certainty about a condition.
Use simple, clear language. End every response with this exact disclaimer: "${disclaimer}"`;

function toLangChainHistory(messages: IMessage[]) {
  return messages.slice(-20).map((message) =>
    message.role === "assistant"
      ? new AIMessage(message.content)
      : new HumanMessage(message.content),
  );
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId || sessionId.length > 128) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  await connectDB();
  const conversation = await Conversation.findOne({
    userId,
    kind: conversationKind,
    sessionId,
  });

  return NextResponse.json({ messages: conversation?.messages ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, summary, ocr, messages } = await req.json();
    if (
      typeof sessionId !== "string" ||
      !sessionId.trim() ||
      sessionId.length > 128 ||
      typeof summary !== "string" ||
      typeof ocr !== "string" ||
      !Array.isArray(messages)
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const latestMessage = messages.at(-1)?.content;
    if (typeof latestMessage !== "string" || !latestMessage.trim()) {
      return NextResponse.json({ error: "Missing user message" }, { status: 400 });
    }

    await connectDB();
    const conversation = await Conversation.findOneAndUpdate(
      { userId, kind: conversationKind, sessionId },
      {
        $setOnInsert: {
          userId,
          kind: conversationKind,
          sessionId,
          context: { summary, ocr },
          messages: [],
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const reportSummary = conversation.context?.summary || summary;
    const reportOcr = conversation.context?.ocr || ocr;
    const model = getLLM("chat");
    const result = await model.invoke([
      new SystemMessage(
        `${systemPrompt}\n\nREPORT SUMMARY:\n${reportSummary}\n\nREPORT OCR:\n${reportOcr}`,
      ),
      ...toLangChainHistory(conversation.messages),
      new HumanMessage(latestMessage.trim()),
    ]);
    let reply = llmContentToText(result.content).trim();
    if (!reply) {
      throw new Error("AI provider returned an empty chat response");
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
              { role: "user", content: latestMessage.trim(), timestamp },
              { role: "assistant", content: reply, timestamp },
            ],
          },
        },
        $set: { updatedAt: timestamp },
      }
    );

    return NextResponse.json({ reply, conversationId: conversation._id });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
