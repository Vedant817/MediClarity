import { auth } from "@clerk/nextjs/server";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getLLM, llmContentToText } from "@/lib/llm";
import { DIAGNOSIS_REFUSAL } from "@/lib/chat-safety";
import {
  classifyRecordChat,
  compactChatHistory,
  EMERGENCY_REPLY,
  OUT_OF_SCOPE_REPLY,
  RECORD_CHAT_DISCLAIMER,
  systemPromptFor,
} from "@/lib/record-chat";
import {
  buildReportCatalog,
  formatScopedRecordContext,
  selectReports,
} from "@/lib/record-retrieval";
import LabResult from "@/models/labResult";
import Medication from "@/models/medication";
import Report from "@/models/report";
import Conversation from "@/models/conversation";
import Appointment from "@/models/appointment";

export const runtime = "nodejs";

const conversationKind = "records-chat";
const disclaimer = RECORD_CHAT_DISCLAIMER;

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

    const route = classifyRecordChat(userMessage);
    const persist = async (reply: string) => {
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
        },
      );
      return NextResponse.json({ reply, conversationId: conversation._id });
    };

    if (route.kind === "emergency") return persist(EMERGENCY_REPLY);
    if (route.kind === "diagnosis") return persist(`${DIAGNOSIS_REFUSAL}\n\n${disclaimer}`);
    if (route.kind === "out_of_scope") return persist(OUT_OF_SCOPE_REPLY);

    const today = new Date().toISOString().split("T")[0];
    const intent = route.recordIntent;
    const [reportIndex, medications, upcomingAppointments] = await Promise.all([
      route.attachReports
        ? Report.find({ userId })
          .select({ reportDate: 1, createdAt: 1, sourceLab: 1 })
          .lean<Array<{ _id: { toString(): string }; reportDate?: Date; createdAt?: Date; sourceLab?: string }>>()
        : Promise.resolve([]),
      route.attachMeds
        ? Medication.find({ userId, status: "active" })
          .select({ name: 1, dose: 1, frequency: 1 })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean()
        : Promise.resolve([]),
      route.attachAppointments
        ? Appointment.find({ patientId: userId, status: "scheduled", date: { $gte: today } })
          .select({ providerId: 1, date: 1, time: 1, reason: 1 })
          .sort({ date: 1 })
          .limit(5)
          .lean()
        : Promise.resolve([]),
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
      route.attachLabs && (intent.includeLabHistory || selectedIds.length)
        ? LabResult.find(
          intent.includeLabHistory
            ? { userId }
            : { userId, reportId: { $in: selectedIds } },
        )
          .select({ reportId: 1, canonicalName: 1, test: 1, value: 1, unit: 1, flag: 1, date: 1 })
          .sort({ date: -1 })
          .limit(intent.includeLabHistory ? 80 : 40)
          .lean()
        : Promise.resolve([]),
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
    const history = compactChatHistory(conversation.messages).map((message) =>
      message.role === "assistant" ? new AIMessage(message.content) : new HumanMessage(message.content),
    );
    const payload = route.kind === "general_education"
      ? `GENERAL QUESTION (do not use patient labs):\n${userMessage.trim()}`
      : `TURN TYPE: ${route.kind}\n\nMEDICAL-RECORD CONTEXT:\n${recordContext}\n\nUSER QUESTION:\n${userMessage.trim()}`;
    const result = await model.invoke([
      new SystemMessage(systemPromptFor(route.kind)),
      ...history,
      new HumanMessage(payload),
    ]);
    let reply = llmContentToText(result.content).trim();
    if (!reply) {
      throw new Error("AI provider returned an empty records-chat response");
    }
    if (!reply.includes(disclaimer)) {
      reply = `${reply}\n\n${disclaimer}`;
    }
    return persist(reply);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Chat failed", reply: "I'm having trouble responding right now. Please try again." },
      { status: 500 }
    );
  }
}
