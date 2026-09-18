const REPORT_HINT = /\b(reports?|records?|results?|motrophs?|motroffs?|motrops?)\b/iu;
const PRECAUTION_HINT = /\b(precautions?|precaution|prevention)\b/iu;
const RECENT_HINT = /\b(last|latest|recent|three|four|3|4)\b/iu;

export function recoverReportPrecautionRequest(transcript: string): string | null {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (!REPORT_HINT.test(text) || !PRECAUTION_HINT.test(text)) return null;
  const wantsRecentSlice = RECENT_HINT.test(text);
  return wantsRecentSlice
    ? "Based on my last three or four reports, what precautions should I take?"
    : "Based on my recent reports, what precautions should I take?";
}

export function parseRepairedTranscript(value: unknown): { cleaned: string; confident: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const cleaned = (value as { cleaned?: unknown }).cleaned;
  const confident = (value as { confident?: unknown }).confident;
  if (typeof cleaned !== "string") return null;
  const text = cleaned.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!text) return null;
  return { cleaned: text, confident: confident === true };
}

export function extractRepairJson(raw: string): { cleaned: string; confident: boolean } | null {
  const match = raw.match(/\{[\s\S]*\}/u);
  if (!match) return null;
  try {
    return parseRepairedTranscript(JSON.parse(match[0]));
  } catch {
    return null;
  }
}

export function buildTranscriptRepairPrompt(keyterms: string[]): string {
  const vocabulary = keyterms.slice(0, 24).join(", ");
  return `You repair noisy speech-to-text for a health-information voice assistant. You do not answer medical questions.

Return JSON only: {"cleaned":"string","confident":true|false}

Rules:
- Recover the patient's most likely request from a messy transcript.
- Prefer ordinary requests: last few reports, precautions, medications, appointments, or a named lab/medicine.
- If the transcript mentions reports and precautions, cleaned must be a clear request to summarize the last few reports and describe precautions from those findings.
- Map near-misses such as motrophs/motroffs to reports, procedure to precautions when reports are also mentioned, and "three to five or four" to "three or four".
- Keep medication and lab names from this vocabulary when present: ${vocabulary || "none"}.
- If meaning is not recoverable, return {"cleaned":"","confident":false}.
- Never diagnose, never invent facts, never add questions for a doctor.`;
}
