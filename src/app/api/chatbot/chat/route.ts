import { auth } from "@clerk/nextjs/server";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getLLM, llmContentToText } from "@/lib/llm";
import { DIAGNOSIS_REFUSAL, isDiagnosisSeeking } from "@/lib/chat-safety";
import {
  buildReportCatalog,
  formatScopedRecordContext,
  parseRecordQuestion,
  selectReports,
} from "@/lib/record-retrieval";
import LabResult from "@/models/labResult";
import Medication from "@/models/medication";
import Report from "@/models/report";
import Conversation, { IMessage } from "@/models/conversation";
import Appointment from "@/models/appointment";

export const runtime = "nodejs";

const conversationKind = "records-chat";
const disclaimer = "For information only, not medical advice. A qualified clinician should interpret these results in your full clinical context.";
const systemPrompt = `You are a health information assistant, not a doctor.
Answer patient-specific questions only from MEDICAL-RECORD CONTEXT. The REPORT CATALOG lists every uploaded report. SELECTED REPORT DETAIL is the only place values may come from for this turn.
FIRST-EVER is the oldest report. MOST RECENT / last report is the newest. LAST TWO are the two newest. Never call an older report "the last report".
Cite the label and ISO date with every value (example: "In your MOST RECENT report (2026-09-10), hemoglobin was 13.2 g/dL").
If the fact is not in SELECTED REPORT DETAIL or LAB HISTORY, say exactly: "Not in report - ask your doctor".
If the user asks whether they have a condition (including "do I have X" or "yes or no"), always give exactly that refusal — describing lab values is allowed, naming a condition the patient has is forbidden, even when related findings exist.
Never diagnose, prescribe, recommend changing treatment, invent findings, or copy a number from the wrong report.
Explain terms in simple language and distinguish general education from facts present in the records.
Format responses cleanly using standard Markdown (prefer structured bullet lists or clean markdown tables; do not output raw HTML tags).
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

    const today = new Date().toISOString().split("T")[0];
    const intent = parseRecordQuestion(userMessage);
    const [reportIndex, medications, upcomingAppointments] = await Promise.all([
      Report.find({ userId })
        .select({ reportDate: 1, createdAt: 1, sourceLab: 1 })
        .lean<Array<{ _id: { toString(): string }; reportDate?: Date; createdAt?: Date; sourceLab?: string }>>(),
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
    const catalog = buildReportCatalog(reportIndex.map((report) => ({
      id: String(report._id),
      date: "",
      sourceLab: report.sourceLab,
      reportDate: report.reportDate,
      createdAt: report.createdAt,
    })));
    const selectedMeta = selectReports(catalog, intent);
    const selectedIds = selectedMeta.map((report) => report.id);
    const [selectedDocs, labHistory] = await Promise.all([
      selectedIds.length
        ? Report.find({ userId, _id: { $in: selectedIds } }).select({ summary: 1 }).lean<Array<{ _id: { toString(): string }; summary?: string }>>()
        : Promise.resolve([]),
      LabResult.find(
        intent.includeLabHistory
          ? { userId }
          : selectedIds.length
            ? { userId, reportId: { $in: selectedIds } }
            : { userId: "__none__" },
      )
        .select({ reportId: 1, canonicalName: 1, test: 1, value: 1, unit: 1, flag: 1, date: 1 })
        .sort({ date: -1 })
        .limit(intent.includeLabHistory ? 80 : 40)
        .lean(),
    ]);
    const summaryById = new Map(selectedDocs.map((report) => [String(report._id), report.summary ?? ""]));
    const labsByReport = new Map<string, typeof labHistory>();
    for (const lab of labHistory) {
      const reportId = String(lab.reportId ?? "");
      if (!reportId) continue;
      const list = labsByReport.get(reportId) ?? [];
      list.push(lab);
      labsByReport.set(reportId, list);
    }
    const recordContext = formatScopedRecordContext({
      catalog,
      selected: selectedMeta.map((report) => ({
        ...report,
        summary: summaryById.get(report.id) ?? "",
        labs: (labsByReport.get(report.id) ?? []).map((lab) => ({
          canonicalName: lab.canonicalName,
          test: lab.test,
          value: lab.value,
          unit: lab.unit,
          flag: lab.flag,
        })),
      })),
      intent,
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
      labHistory: intent.includeLabHistory
        ? labHistory.map((lab) => ({
          canonicalName: lab.canonicalName,
          test: lab.test,
          value: lab.value,
          unit: lab.unit,
          flag: lab.flag,
          date: lab.date,
        }))
        : undefined,
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
