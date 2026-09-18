export type SchedulerReport = {
  reportDate?: Date | string | null;
  sourceLab?: string | null;
  summary?: string | null;
  createdAt?: Date | string | null;
};

export type SchedulerMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

import { addIsoDays } from "./appointment-slot.ts";

export type SchedulerTag = "SUGGESTED_DOCTORS" | "BOOKING_READY" | "RESCHEDULE_READY";

export type SuggestedDoctor = {
  id: string;
  name: string;
  specialty: string;
  justification?: string;
};

export type SchedulerSlot = { date: string; time: string };
export type ProviderOpenings = { providerId: string; slots: SchedulerSlot[] };

const UNVERIFIED_BOOKING_CLAIM = /\b(?:your\s+(?:appointment|booking|slot)\s+(?:is|has been)\s+(?:confirmed|booked|scheduled|reserved)|(?:i(?:'ve| have)|we(?:'ve| have))\s+(?:booked|scheduled|confirmed|reserved)\s+(?:your|the)\s+(?:appointment|booking|slot))\b/i;
const UNVERIFIED_READY_CLAIM = /\bappointment details are ready\b|\bcomplete the booking\b/i;

function compactText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

/**
 * The scheduler only needs a small clinical hint for provider matching. Sending
 * whole report summaries on every turn quickly exhausts provider token limits.
 */
export function compactSchedulerReports(
  reports: SchedulerReport[],
  options: { maxReports?: number; maxSummaryChars?: number } = {},
) {
  const maxReports = options.maxReports ?? 3;
  const maxSummaryChars = options.maxSummaryChars ?? 700;

  return reports.slice(0, maxReports).map((report) => ({
    reportDate: report.reportDate ?? null,
    sourceLab: report.sourceLab ?? null,
    summary: compactText(report.summary ?? "", maxSummaryChars),
  }));
}

/** Keep the newest turns while enforcing a hard character budget. */
export function boundedSchedulerMessages(
  messages: SchedulerMessage[],
  options: { maxMessages?: number; maxChars?: number; maxMessageChars?: number } = {},
): SchedulerMessage[] {
  const maxMessages = options.maxMessages ?? 10;
  const maxChars = options.maxChars ?? 6_000;
  const maxMessageChars = options.maxMessageChars ?? 1_200;
  const selected: SchedulerMessage[] = [];
  let used = 0;

  for (const message of messages.slice(-maxMessages).reverse()) {
    const content = compactText(message.content, Math.min(maxMessageChars, maxChars - used));
    if (!content) continue;
    if (used + content.length > maxChars) break;
    selected.push({ role: message.role, content });
    used += content.length;
  }

  return selected.reverse();
}

function taggedJsonSpan(message: string, tag: SchedulerTag): { json: string; start: number; end: number } | null {
  const markerIndex = message.indexOf(tag);
  if (markerIndex < 0) return null;

  let cursor = markerIndex + tag.length;
  while (/\s/.test(message[cursor] ?? "")) cursor += 1;
  if (message.startsWith("```", cursor)) {
    cursor += 3;
    if (message.slice(cursor, cursor + 4).toLowerCase() === "json") cursor += 4;
    while (/\s/.test(message[cursor] ?? "")) cursor += 1;
  }

  const opening = message[cursor];
  if (opening !== "{" && opening !== "[") return null;
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = cursor; index < message.length; index += 1) {
    const character = message[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) depth -= 1;
    if (depth !== 0) continue;

    let end = index + 1;
    while (/\s/.test(message[end] ?? "")) end += 1;
    if (message.startsWith("```", end)) end += 3;
    return { json: message.slice(cursor, index + 1), start: markerIndex, end };
  }

  return null;
}

export function extractSchedulerTaggedJson<T>(message: string, tag: SchedulerTag): T | null {
  const span = taggedJsonSpan(message, tag);
  if (!span) return null;
  try {
    return JSON.parse(span.json) as T;
  } catch {
    return null;
  }
}

export function stripSchedulerMetadata(message: string): string {
  let result = normalizeSchedulerGlyphs(message);
  for (const tag of ["SUGGESTED_DOCTORS", "BOOKING_READY", "RESCHEDULE_READY"] as const) {
    let span = taggedJsonSpan(result, tag);
    while (span) {
      result = `${result.slice(0, span.start)}${result.slice(span.end)}`;
      span = taggedJsonSpan(result, tag);
    }
    result = result.replaceAll(tag, "");
  }
  result = stripLooseSchedulerJson(result);
  return result
    .split("\n")
    .filter((line) => !/^\s*```(?:json)?\s*$/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function replaceRelativeSchedulerDates(response: string, currentDate: string): string {
  const tomorrow = addIsoDays(currentDate, 1);
  return response
    .replace(/\btomorrow\b/gi, tomorrow)
    .replace(/\btoday\b/gi, currentDate);
}

export function resolveRelativeBookingDate(
  userText: string,
  proposedDate: string,
  currentDate: string,
): string {
  const text = userText.toLowerCase();
  const mentionsTomorrow = /\btomorrow\b/.test(text);
  const mentionsToday = /\btoday\b/.test(text);
  if (mentionsTomorrow && !mentionsToday) return addIsoDays(currentDate, 1);
  if (mentionsToday && !mentionsTomorrow) return currentDate;
  return proposedDate;
}

/**
 * Model text is never proof of a database write. A valid BOOKING_READY payload
 * is only a proposal; the authenticated server action performs the booking.
 */
export function guardUnverifiedBookingClaim(response: string): string {
  if (!UNVERIFIED_BOOKING_CLAIM.test(response) && !UNVERIFIED_READY_CLAIM.test(response)) return response;

  const marker = "BOOKING_READY";
  const markerIndex = response.indexOf(marker);
  if (markerIndex >= 0) {
    return [
      "Your appointment details are ready. Select Schedule Appointment below to complete the booking.",
      response.slice(markerIndex).trim(),
    ].join("\n\n");
  }

  return "Your appointment has not been booked yet. I still need to prepare a validated booking confirmation before you can schedule it.";
}

export function normalizeSchedulerGlyphs(message: string): string {
  return message
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u00A0\u202F\u2007]/g, " ");
}

function isSuggestedDoctor(value: unknown): value is SuggestedDoctor {
  if (!value || typeof value !== "object") return false;
  const doctor = value as SuggestedDoctor;
  return typeof doctor.id === "string" && typeof doctor.name === "string" && typeof doctor.specialty === "string";
}

function jsonValueSpans(message: string): Array<{ json: string; start: number; end: number; value: unknown }> {
  const spans: Array<{ json: string; start: number; end: number; value: unknown }> = [];
  for (let index = 0; index < message.length; index += 1) {
    const opening = message[index];
    if (opening !== "{" && opening !== "[") continue;
    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let cursor = index; cursor < message.length; cursor += 1) {
      const character = message[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === opening) depth += 1;
      if (character === closing) depth -= 1;
      if (depth !== 0) continue;
      const json = message.slice(index, cursor + 1);
      try {
        spans.push({ json, start: index, end: cursor + 1, value: JSON.parse(json) });
      } catch {
        break;
      }
      index = cursor;
      break;
    }
  }
  return spans;
}

function looksLikeSchedulerPayload(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0 && value.every(isSuggestedDoctor);
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.providerId === "string" && typeof record.date === "string" && typeof record.time === "string";
}

export function extractSuggestedDoctors(message: string): SuggestedDoctor[] {
  const tagged = extractSchedulerTaggedJson<unknown>(message, "SUGGESTED_DOCTORS");
  if (Array.isArray(tagged) && tagged.every(isSuggestedDoctor)) return tagged;
  const match = jsonValueSpans(normalizeSchedulerGlyphs(message)).find((span) =>
    Array.isArray(span.value) && span.value.length > 0 && span.value.every(isSuggestedDoctor));
  return Array.isArray(match?.value) ? match.value.filter(isSuggestedDoctor) : [];
}

export function stripLooseSchedulerJson(message: string): string {
  const normalized = normalizeSchedulerGlyphs(message);
  const spans = jsonValueSpans(normalized).filter((span) => looksLikeSchedulerPayload(span.value));
  let result = normalized;
  for (const span of [...spans].reverse()) {
    const prefix = result.slice(0, span.start);
    const suffix = result.slice(span.end);
    const fence = prefix.match(/(?:\*{0,4}\s*)?(?:```)?json\s*$/i);
    const start = fence ? span.start - fence[0].length : span.start;
    result = `${result.slice(0, start)}${suffix}`;
  }
  return result.replace(/```json\s*```/gi, "").replace(/\*{3,}/g, "").replace(/[ \t]+\n/g, "\n");
}

export function formatVerifiedSlotsForPrompt(
  openings: ProviderOpenings[],
  providers: Array<{ id: string; name: string }>,
): string {
  const names = new Map(providers.map((provider) => [provider.id, provider.name]));
  return openings.map((entry) => {
    const heading = names.get(entry.providerId) ?? entry.providerId;
    const byDate = new Map<string, string[]>();
    for (const slot of entry.slots) {
      byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot.time]);
    }
    const days = [...byDate.entries()].map(([date, times]) =>
      `  ${formatSlotHeading(date)}\n${times.map((time) => `    - ${time}`).join("\n")}`);
    return `${heading} (${entry.providerId})\n${days.join("\n")}`;
  }).join("\n\n");
}

export function formatLooseSlotListing(message: string): string {
  const slotPattern = /\d{4}-\d{2}-\d{2}[ \t]+\d{2}:\d{2}/g;
  const normalized = normalizeSchedulerGlyphs(message);
  return normalized.replace(/(?:\d{4}-\d{2}-\d{2}[ \t]+\d{2}:\d{2}(?:[ \t]*[\n,;]?[ \t]*)?){2,}/g, (block) => {
    const slots = block.match(slotPattern) ?? [];
    if (slots.length < 2) return block;
    const byDate = new Map<string, string[]>();
    for (const slot of slots) {
      const [date, time] = slot.split(/[ \t]+/);
      const times = byDate.get(date) ?? [];
      if (!times.includes(time)) times.push(time);
      byDate.set(date, times);
    }
    const listing = [...byDate.entries()]
      .map(([date, times]) => `**${formatSlotHeading(date)}**\n${times.map((time) => `- ${time}`).join("\n")}`)
      .join("\n\n");
    return `\n\n${listing}\n\n`;
  }).replace(/\n{3,}/g, "\n\n").trim();
}

function formatSlotHeading(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function canonicalizeSchedulerResponse(options: {
  prose: string;
  doctors?: SuggestedDoctor[];
  booking?: unknown;
  reschedule?: unknown;
}): string {
  const parts = [formatLooseSlotListing(stripSchedulerMetadata(options.prose)).trim()].filter(Boolean);
  if (options.doctors && options.doctors.length > 0) {
    parts.push(`SUGGESTED_DOCTORS ${JSON.stringify(options.doctors)}`);
  }
  if (options.booking) parts.push(`BOOKING_READY ${JSON.stringify(options.booking)}`);
  if (options.reschedule) parts.push(`RESCHEDULE_READY ${JSON.stringify(options.reschedule)}`);
  return parts.join("\n\n");
}
