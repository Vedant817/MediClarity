import { removeKnownLabTerms } from "./labs.ts";

export const DIAGNOSIS_REFUSAL = "Not in report - ask your doctor";

const VALUE_WORDS = new Set([
  "low", "high", "normal", "elevated", "decreased",
  "level", "levels", "value", "values", "result", "results",
  "range", "reading", "readings", "count", "counts",
]);

const FILLER = new Set([
  "and", "or", "with", "plus", "my", "the", "a", "an", "any", "some",
  "of", "to", "for", "is", "are", "am", "be", "have", "has", "it",
  "this", "that", "very", "slightly", "bit", "mildly", "do", "does",
  "did", "at", "on", "in", "as", "by", "no", "so", "up", "me", "us",
  "we", "he", "she", "they", "them", "his", "her", "our", "your",
  "before", "about", "fast", "fasting",
]);

// Administrative + time vocabulary: stripped before asking whether anything
// condition-like remains, so "an appointment and cancer" still refuses via
// "cancer" while "any upcoming appointments" clears completely.
const ADMIN_WORDS = new Set([
  "appointment", "appointments", "upcoming", "report", "reports",
  "result", "results", "lab", "labs", "test", "tests", "visit", "visits",
  "message", "messages", "account", "profile", "plan", "plans",
  "subscription", "subscriptions", "medicine", "medicines",
  "prescription", "prescriptions", "notification", "notifications",
  "today", "tomorrow", "yesterday", "morning", "afternoon", "evening",
  "night", "week", "month", "year", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday", "sunday", "next", "last", "on", "at", "in",
  "medication", "medications", "drug", "drugs", "bill", "bills",
  "insurance", "clinic", "clinics", "doctor", "doctors",
]);

// Condition-seeking triggers (`[\s\S]` classes so newlines can't split
// the match). Each captures the remainder (may be empty), which
// remainderHasCondition then judges. Bare symptom reports ("I have chest
// pain, help") carry no trigger and always reach the model.
const TRIGGERS: RegExp[] = [
  /\bdo i have\b\s*([\s\S]+?)(\?|$)/i,
  /\bhave i got\b\s*([\s\S]+?)(\?|$)/i,
  /\bcould i have\b\s*([\s\S]+?)(\?|$)/i,
  /\bmight i have\b\s*([\s\S]+?)(\?|$)/i,
  /\bdo you think i(?: (?:might|may|could))? have\b\s*([\s\S]+?)(\?|$)/i,
  /\bis it possible (?:that )?i have\b\s*([\s\S]+?)(\?|$)/i,
  /\bi think i have\b\s*([\s\S]+?)(\?|$)/i,
  /\bwhat do i have\b\s*([\s\S]*?)(\?|$)/i,
  /\b(?:if|whether)\s+i\s+(?:(?:might|may|could)\s+)?have\b\s*([\s\S]+?)(\?|$)/i,
  /\bworry\b[^.?!]{0,80}\bi have\b\s*([\s\S]+?)(\?|$)/i,
];

/**
 * Deterministic diagnosis-seeking detector. The LLM prompt also forbids
 * diagnosis, but rich record context can make the model confident enough
 * to override soft instructions — so condition questions bypass the model
 * entirely with the exact refusal. Lab-value questions ("do I have low
 * hemoglobin") and admin questions still go to the model.
 */
export function isDiagnosisSeeking(message: string): boolean {
  if (typeof message !== "string") return false;
  const text = message.trim();
  if (!text) return false;
  if (/\bdiagnose\s+me\b|\bam i diagnosed\b|\bdo i suffer from\b/i.test(text)) return true;

  for (const trigger of TRIGGERS) {
    // Global scan: every occurrence is judged, so a benign first clause
    // ("do I have low hemoglobin?") cannot shield a later condition
    // ("do I have cancer?"). Refuse if ANY occurrence refuses.
    const global = new RegExp(trigger.source, "gi");
    let match: RegExpExecArray | null;
    let sawTrigger = false;
    while ((match = global.exec(text)) !== null) {
      sawTrigger = true;
      const rest = (match[1] ?? "").replace(/[?.!]+$/, "").trim();
      if (!rest) return true;
      if (/^to\s+[a-z]/i.test(rest)) continue;
      if (remainderHasCondition(rest)) return true;
    }
    if (sawTrigger) {
      // Trigger fired but every occurrence cleared as lab/admin content.
      continue;
    }
  }
  return false;
}

/**
 * True when the remainder names something beyond lab values, numbers,
 * admin/scheduling vocabulary, and filler — i.e. a condition (or anything
 * else the record cannot answer as a measurement). Known lab phrases are
 * stripped longest-first so "anemia and low hemoglobin" still refuses via
 * "anemia", while "low hemoglobin" clears completely.
 */
function remainderHasCondition(rest: string): boolean {
  const stripped = removeKnownLabTerms(rest);
  const tokens = stripped.split(/[^a-z]+/).filter(Boolean);
  return tokens.some(
    (token) =>
      token.length >= 2 &&
      !VALUE_WORDS.has(token) &&
      !FILLER.has(token) &&
      !ADMIN_WORDS.has(token) &&
      !/^\d+$/.test(token),
  );
}
