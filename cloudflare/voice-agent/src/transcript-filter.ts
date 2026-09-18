const NOISE_ONLY = /^(?:\[?(?:noise|background noise|music|silence|inaudible)\]?|(?:uh+|um+|hmm+|mm+|ah+)[.!?\s]*)$/iu;
const LAB_TOKEN = /^(?:mc[hvc]|mchc|mpv|rdw|wbc|rbc|plt|hgb|hb|hba1c|t[034]|tsh|hdl|ldl|sgot|sgpt|bun|egfr|mng|ng|pg|ml|mg|dl|iu|mmol|tru|fg)$/i;
const INTENT_WORD = /\b(reports?|labs?|results?|precautions?|medications?|medicines?|appointments?|hemoglobin|hba1c|thyroid|cholesterol|diabetes|recent|latest)\b/giu;
const QUESTION_WORD = /\b(what|what's|whats|how|why|should|could|please|tell|explain|based|summarize|discuss)\b/iu;

function tokens(value: string): string[] {
  return value.split(/[\s,;:/|]+/u).map((token) => token.replace(/[^\p{L}\p{N}%]+/gu, "")).filter(Boolean);
}

export function isHallucinatedLabDump(value: string): boolean {
  const parts = tokens(value);
  if (parts.length < 6) return false;
  const labish = parts.filter((part) => LAB_TOKEN.test(part)).length;
  const short = parts.filter((part) => part.length <= 4).length;
  return labish >= 3 && short / parts.length >= 0.55;
}

export function looksLikeWordSalad(value: string): boolean {
  const words = value.toLowerCase().match(/\p{L}{2,}/gu) ?? [];
  if (words.length < 8) return false;
  const intents = value.match(INTENT_WORD)?.length ?? 0;
  if (intents >= 2) return false;
  if (QUESTION_WORD.test(value) && intents >= 1) return false;
  return intents <= 1;
}

const INDIC_SCRIPT = /\p{Script=Devanagari}|\p{Script=Gurmukhi}|\p{Script=Bengali}|\p{Script=Tamil}|\p{Script=Telugu}|\p{Script=Gujarati}|\p{Script=Kannada}|\p{Script=Malayalam}/u;

export function spokenRequestScore(value: string): number {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || isHallucinatedLabDump(text) || looksLikeWordSalad(text)) return 0;
  const words = text.match(/\p{L}{2,}/gu) ?? [];
  if (!words.length) return 0;
  let score = 2;
  const intents = text.match(INTENT_WORD)?.length ?? 0;
  score += Math.min(4, intents * 2);
  if (QUESTION_WORD.test(text)) score += 2;
  if (words.length >= 6) score += 1;
  if (INDIC_SCRIPT.test(text) && words.length >= 2) score += 4;
  return score;
}

export function isPlausibleSpokenRequest(value: string): boolean {
  return spokenRequestScore(value) >= 4;
}

export function cleanVoiceTranscript(value: string): string | null {
  const cleaned = value
    .replace(/\[(?:noise|background noise|music|silence|inaudible)\]/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2_000);
  if (!cleaned || NOISE_ONLY.test(cleaned) || isHallucinatedLabDump(cleaned)) return null;
  return cleaned;
}

export function pcm16Rms(chunk: ArrayBuffer): number {
  const samples = new Int16Array(chunk, 0, Math.floor(chunk.byteLength / 2));
  if (!samples.length) return 0;
  let energy = 0;
  for (const sample of samples) {
    const normalized = sample / 32768;
    energy += normalized * normalized;
  }
  return Math.sqrt(energy / samples.length);
}
