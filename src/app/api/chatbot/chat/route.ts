import { auth } from "@clerk/nextjs/server";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getLLM, llmContentToText } from "@/lib/llm";
import { DIAGNOSIS_REFUSAL, isDiagnosisSeeking } from "@/lib/chat-safety";
import { buildRecordContext } from "@/lib/records-context";
import LabResult from "@/models/labResult";
import Medication from "@/models/medication";
import Report from "@/models/report";
import Conversation, { IMessage } from "@/models/conversation";
import Appointment from "@/models/appointment";

export const runtime = "nodejs";

const conversationKind = "records-chat";
const disclaimer = "For information only, not medical advice. A qualified clinician should interpret these results in your full clinical context.";
const systemPrompt = `You are a health information assistant, not a doctor.
Answer patient-specific questions only from the medical-record context supplied with the message. That context spans the current report AND the patient's earlier reports, abnormal labs, and medications: use all of it.
When you answer from an earlier report, say which one (e.g. "In your June CBC…").
If the requested information is absent from the whole record, say exactly: "Not in report - ask your doctor".
If the user asks whether they have a condition (including "do I have X" or "yes or no"), always give exactly that refusal — describing lab values is allowed, naming a condition the patient has is forbidden, even when related findings exist.
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
    if (userMessage.trim().length > 2000) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 });
    }

    // Deterministic safety gate: condition questions ("do I have X") bypass
    // the model entirely with the exact refusal. Rich record context can
    // make the LLM confident enough to override soft prompt instructions,
    // so this must not depend on the model. The exchange is still persisted.
    if (isDiagnosisSeeking(userMessage)) {
      const timestamp = new Date();
      const reply = `${DIAGNOSIS_REFUSAL}\n\n${disclaimer}`;
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
        },
      );
      return NextResponse.json({ reply, conversationId: conversation._id });
    }

    const summary = conversation.context?.summary?.trim();
    const ocr = conversation.context?.ocr?.trim();
    const today = new Date().toISOString().split("T")[0];
    // Full-record context: the session's current report plus earlier
    // reports, abnormal labs, active medications, and upcoming visits.
    const [pastReports, abnormalLabs, medications, upcomingAppointments] = await Promise.all([
      Report.find({ userId })
        .select({ summary: 1, reportDate: 1, createdAt: 1 })
        .sort({ reportDate: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      LabResult.find({ userId, flag: { $in: ["high", "low"] } })
        .select({ canonicalName: 1, test: 1, value: 1, unit: 1, flag: 1, date: 1 })
        .sort({ date: -1 })
        .limit(15)
        .lean(),
      Medication.find({ userId, status: "active" })
        .select({ name: 1, dose: 1, frequency: 1 })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Appointment.find({ patientId: userId, status: "scheduled", date: { $gte: today } })
        .select({ providerId: 1, date: 1, time: 1, reason: 1 })
        .sort({ date: 1 })
        .limit(5)
        .lean(),
    ]);
    const currentSummary = (summary ?? "").trim();
    // Skip one copy of the session's current report in history: it already
    // ships at full detail above. Only the first exact match is dropped so
    // templated duplicates still contribute their dates.
    let skippedCurrent = false;
    const historyReports = pastReports.filter((report) => {
      if (!skippedCurrent && currentSummary && (report.summary ?? "").trim() === currentSummary) {
        skippedCurrent = true;
        return false;
      }
      return true;
    });
    const recordContext = buildRecordContext({
      currentSummary: summary,
      currentOcr: ocr,
      pastReports: historyReports.map((report) => ({
        date: report.reportDate ?? report.createdAt,
        summary: report.summary,
      })),
      abnormalLabs: abnormalLabs.map((lab) => ({
        canonicalName: lab.canonicalName,
        test: lab.test,
        value: lab.value,
        unit: lab.unit,
        flag: lab.flag,
        date: lab.date,
      })),
      medications: medications.map((medication) => ({
        name: medication.name,
        dose: medication.dose,
        frequency: medication.frequency,
      })),
      upcomingAppointments: upcomingAppointments.map((appointment) => ({
        providerId: appointment.providerId,
        date: appointment.date,
        time: appointment.time,
        reason: appointment.reason,
      })),
    });

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
