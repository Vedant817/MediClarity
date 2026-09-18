import { isDiagnosisSeeking } from "./chat-safety.ts";
import { mentionsKnownLab } from "./labs.ts";
import {
  parseRecordQuestion,
  type RecordQuestionIntent,
} from "./record-retrieval.ts";

export const RECORD_CHAT_DISCLAIMER =
  "For information only, not medical advice. A qualified clinician should interpret these results in your full clinical context.";

export const DIAGNOSIS_REFUSAL = "Not in report - ask your doctor";

export const EMERGENCY_REPLY = [
  "If you have severe, sudden, or worsening symptoms — such as chest pain, trouble breathing, signs of stroke, severe bleeding, or thoughts of self-harm — contact local emergency services now. Do not wait for this chat.",
  "I cannot triage emergencies or tell you whether you are safe to stay home.",
  RECORD_CHAT_DISCLAIMER,
].join("\n\n");

export const OUT_OF_SCOPE_REPLY = [
  "I can help with your uploaded lab reports, medications, appointments, or general health information. I cannot help with that topic here.",
  RECORD_CHAT_DISCLAIMER,
].join("\n\n");

export type ChatRouteKind =
  | "emergency"
  | "diagnosis"
  | "record"
  | "navigation"
  | "general_education"
  | "mixed"
  | "out_of_scope";

export type RecordChatRoute = {
  kind: ChatRouteKind;
  recordIntent: RecordQuestionIntent;
  attachReports: boolean;
  attachLabs: boolean;
  attachMeds: boolean;
  attachAppointments: boolean;
};

const EMERGENCY = /\b(chest pain|pressure in (?:my |the )?chest|can'?t breathe|cannot breathe|trouble breathing|shortness of breath with chest|suicid|kill myself|want to die|overdose|stroke|face droop|coughing blood|vomiting blood|severe bleeding|unconscious|passed out|anaphylaxis|allergic shock)\b/i;

const PERSONAL = /\b(my|mine|i have|i've got|i got)\b/i;
const RECORD_NOUNS = /\b(report|reports|lab|labs|result|results|cbc|test|tests|reading|readings|value|values|hemoglobin|cholesterol|ldl|hdl|glucose|creatinine|tsh|hba1c|platelet|wbc)\b/i;
const EDUCATION = /\b((?:what is|what's|whats)(?! in\b)|how does|how do(?:es)? |how to|why is|explain|meaning of|foods?|diet|exercise|lifestyle|sleep|hydration|generally|in general|people with)\b/i;
const SUGGESTION = /\b(should i|can i|what should|any (?:tips|advice|suggestions)|recommend|suggestion|tips for|how can i (?:lower|improve|reduce|raise|manage))\b/i;
const NAV_APPT = /\b(appointment|appointments|schedule|visit|doctor|clinic)\b/i;
const NAV_MEDS = /\b(medication|medications|medicine|medicines|pills?|dose|doses|prescription)\b/i;
const OUT_OF_SCOPE = /\b(write (?:me )?code|python|javascript|stock|crypto|homework|essay|poem|joke|weather in|who won the|translate this code)\b/i;

export function classifyRecordChat(question: string): RecordChatRoute {
  const text = question.trim();
  const recordIntent = parseRecordQuestion(text);
  const personal = PERSONAL.test(text);
  const aboutRecord = RECORD_NOUNS.test(text) || mentionsKnownLab(text) || recordIntent.scope.type !== "unspecified";
  const education = EDUCATION.test(text) || SUGGESTION.test(text);
  const navigation = (NAV_APPT.test(text) || NAV_MEDS.test(text)) && !aboutRecord;

  if (EMERGENCY.test(text)) {
    return { kind: "emergency", recordIntent, attachReports: false, attachLabs: false, attachMeds: false, attachAppointments: false };
  }
  if (isDiagnosisSeeking(text)) {
    return { kind: "diagnosis", recordIntent, attachReports: false, attachLabs: false, attachMeds: false, attachAppointments: false };
  }
  if (OUT_OF_SCOPE.test(text) && !aboutRecord) {
    return { kind: "out_of_scope", recordIntent, attachReports: false, attachLabs: false, attachMeds: false, attachAppointments: false };
  }
  if (personal && aboutRecord && education) {
    return { kind: "mixed", recordIntent, attachReports: true, attachLabs: true, attachMeds: true, attachAppointments: false };
  }
  if (personal && aboutRecord) {
    return { kind: "record", recordIntent, attachReports: true, attachLabs: true, attachMeds: recordIntent.includeLabHistory, attachAppointments: false };
  }
  if (recordIntent.scope.type !== "unspecified") {
    return { kind: "record", recordIntent, attachReports: true, attachLabs: true, attachMeds: false, attachAppointments: false };
  }
  if (navigation) {
    return {
      kind: "navigation",
      recordIntent,
      attachReports: false,
      attachLabs: false,
      attachMeds: NAV_MEDS.test(text),
      attachAppointments: NAV_APPT.test(text),
    };
  }
  if (education || SUGGESTION.test(text)) {
    return { kind: "general_education", recordIntent, attachReports: false, attachLabs: false, attachMeds: false, attachAppointments: false };
  }
  if (personal && (NAV_MEDS.test(text) || NAV_APPT.test(text))) {
    return {
      kind: "navigation",
      recordIntent,
      attachReports: false,
      attachLabs: false,
      attachMeds: NAV_MEDS.test(text),
      attachAppointments: NAV_APPT.test(text),
    };
  }
  if (personal) {
    return { kind: "record", recordIntent, attachReports: true, attachLabs: true, attachMeds: true, attachAppointments: true };
  }
  return { kind: "general_education", recordIntent, attachReports: false, attachLabs: false, attachMeds: false, attachAppointments: false };
}

export function systemPromptFor(kind: ChatRouteKind): string {
  const shared = `You are a health information assistant, not a doctor. Never diagnose, prescribe, or tell the user to start, stop, or change a medication. End with this exact disclaimer: "${RECORD_CHAT_DISCLAIMER}"`;

  if (kind === "general_education") {
    return `${shared}
The user asked a general question. Answer in plain language as general education only.
Do not use any patient labs, even if you remember them from earlier in the chat.
Do not say "your results" or imply the user has a condition.
If they want their own numbers, ask them to phrase it as a question about their reports.`;
  }
  if (kind === "mixed") {
    return `${shared}
Split the answer in two labeled parts:
1. From your record — values only from SELECTED REPORT DETAIL, each with the report label and ISO date.
2. General information — education only, not a personal treatment plan.
Do not present general tips as if they were prescribed for this patient.
If a value is not in SELECTED REPORT DETAIL, say exactly: "${DIAGNOSIS_REFUSAL}"`;
  }
  if (kind === "navigation") {
    return `${shared}
Answer only from ACTIVE MEDICATIONS and UPCOMING APPOINTMENTS in the context. If the item is not listed, say exactly: "${DIAGNOSIS_REFUSAL}"`;
  }
  return `${shared}
Answer patient-specific questions only from MEDICAL-RECORD CONTEXT.
FIRST-EVER is the oldest report. MOST RECENT / last report is the newest. LAST TWO are the two newest.
Cite the label and ISO date with every value.
If the fact is not in SELECTED REPORT DETAIL or LAB HISTORY, say exactly: "${DIAGNOSIS_REFUSAL}"
Never copy a number from the wrong report.`;
}

export function compactChatHistory(
  messages: Array<{ role: string; content: string }>,
  options: { maxMessages?: number; maxChars?: number } = {},
) {
  const maxMessages = options.maxMessages ?? 8;
  const maxChars = options.maxChars ?? 4_000;
  const selected: Array<{ role: string; content: string }> = [];
  let used = 0;
  for (const message of messages.slice(-maxMessages).reverse()) {
    const content = message.content.replace(/\s+/g, " ").trim().slice(0, 800);
    if (!content) continue;
    if (used + content.length > maxChars) break;
    selected.push({ role: message.role, content });
    used += content.length;
  }
  return selected.reverse();
}
