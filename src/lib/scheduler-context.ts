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

export type SchedulerTag = "SUGGESTED_DOCTORS" | "BOOKING_READY" | "RESCHEDULE_READY" | "AVAILABLE_SLOTS";

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
  for (const tag of ["SUGGESTED_DOCTORS", "BOOKING_READY", "RESCHEDULE_READY", "AVAILABLE_SLOTS"] as const) {
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

function isProviderOpenings(value: unknown): value is ProviderOpenings {
  if (!value || typeof value !== "object") return false;
  const entry = value as ProviderOpenings;
  return typeof entry.providerId === "string" && Array.isArray(entry.slots)
    && entry.slots.every((slot) => typeof slot?.date === "string" && typeof slot?.time === "string");
}

function looksLikeSchedulerPayload(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0 && (value.every(isSuggestedDoctor) || value.every(isProviderOpenings));
  }
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.providerId === "string" && typeof record.date === "string" && typeof record.time === "string";
}

export function doctorDisplayName(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  const withoutTitle = trimmed.replace(/^dr\.?\s+/i, "").trim();
  return withoutTitle ? `Dr. ${withoutTitle}` : trimmed;
}

export function matchProviderFromText(
  text: string,
  providers: Array<{ id: string; name: string }>,
): { id: string; name: string } | undefined {
  const normalized = text.toLowerCase();
  const matches = providers
    .map((provider) => {
      const name = provider.name.toLowerCase();
      const withoutTitle = name.replace(/^dr\.?\s+/, "");
      if (normalized.includes(name) || (withoutTitle && normalized.includes(withoutTitle))) {
        return { provider, score: withoutTitle.length };
      }
      if (normalized.includes(provider.id.toLowerCase())) return { provider, score: 1 };
      return null;
    })
    .filter((entry): entry is { provider: { id: string; name: string }; score: number } => Boolean(entry))
    .sort((left, right) => right.score - left.score);
  return matches[0]?.provider;
}

export function capProviderOpenings(openings: ProviderOpenings[], maxDays = 5): ProviderOpenings[] {
  return openings.map((entry) => {
    const dates = [...new Set(entry.slots.map((slot) => slot.date))].slice(0, maxDays);
    const allowed = new Set(dates);
    return { providerId: entry.providerId, slots: entry.slots.filter((slot) => allowed.has(slot.date)) };
  }).filter((entry) => entry.slots.length > 0);
}

export function extractAvailableSlots(message: string): ProviderOpenings[] {
  const tagged = extractSchedulerTaggedJson<unknown>(message, "AVAILABLE_SLOTS");
  if (!Array.isArray(tagged)) return [];
  return tagged.filter(isProviderOpenings);
}

export function stripFormattedSlotBlocks(message: string): string {
  return message
    .replace(/\*\*[^*\n]+ \d{4}\*\*\n(?:- \d{2}:\d{2}\n?)*/g, "")
    .replace(/(?:^|\n)(?:\d{4}-\d{2}-\d{2}[ \t]+\d{2}:\d{2}(?:[ \t]*[\n,;]?[ \t]*)?)+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

export function formatSlotHeading(date: string): string {
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

export function messageHasSchedulerAction(message: string): boolean {
  return Boolean(
    extractSchedulerTaggedJson(message, "BOOKING_READY")
    || extractSchedulerTaggedJson(message, "RESCHEDULE_READY"),
  );
}

export function proposalFingerprint(proposal: { providerId?: string; date?: string; time?: string } | null | undefined): string | null {
  if (!proposal?.providerId || !proposal.date || !proposal.time) return null;
  return `${proposal.providerId}|${proposal.date}|${proposal.time}`;
}

function proposalFromMessage(message: string): { providerId?: string; date?: string; time?: string } | null {
  return extractSchedulerTaggedJson(message, "RESCHEDULE_READY")
    ?? extractSchedulerTaggedJson(message, "BOOKING_READY");
}

/**
 * Replace only the assistant turn that matches a completed booking.
 * Later reschedule/booking payloads must stay intact so their confirm buttons render.
 */
export function retireConsumedProposalMessages<T extends { role: string; content: string }>(
  messages: T[],
  consumed: { providerId?: string; date?: string; time?: string; summary?: string } | null | undefined,
): T[] {
  const fingerprint = proposalFingerprint(consumed);
  const summary = consumed?.summary?.trim();
  if (!fingerprint || !summary) return messages;
  return messages.map((message) => {
    if (message.role !== "assistant") return message;
    const proposal = proposalFromMessage(message.content);
    if (proposalFingerprint(proposal) !== fingerprint) return message;
    return { ...message, content: summary };
  });
}

export function retireSchedulerActionMessages<T extends { role: string; content: string }>(
  messages: T[],
  confirmation: string,
): T[] {
  return retireConsumedProposalMessages(messages, {
    ...proposalFromMessage(messages.find((message) => message.role === "assistant" && messageHasSchedulerAction(message.content))?.content ?? ""),
    summary: confirmation,
  });
}

/** True when this exact slot is already on the user's list or was just completed. */
export function bookingProposalAlreadyCompleted(
  proposal: { providerId?: string; date?: string; time?: string },
  scheduled: Array<{ providerId: string; date: string; time: string }>,
  consumed?: { providerId?: string; date?: string; time?: string } | null,
): boolean {
  if (!proposal.providerId || !proposal.date || !proposal.time) return false;
  if (proposalFingerprint(consumed) === proposalFingerprint(proposal)) return true;
  return scheduled.some((visit) =>
    visit.providerId === proposal.providerId && visit.date === proposal.date && visit.time === proposal.time);
}

export function canonicalizeSchedulerResponse(options: {
  prose: string;
  doctors?: SuggestedDoctor[];
  slots?: ProviderOpenings[];
  booking?: unknown;
  reschedule?: unknown;
}): string {
  let prose = formatLooseSlotListing(stripSchedulerMetadata(options.prose)).trim();
  if (options.slots && options.slots.length > 0) prose = stripFormattedSlotBlocks(prose);
  const parts = [prose].filter(Boolean);
  if (options.doctors && options.doctors.length > 0) {
    parts.push(`SUGGESTED_DOCTORS ${JSON.stringify(options.doctors)}`);
  }
  if (options.slots && options.slots.length > 0) {
    parts.push(`AVAILABLE_SLOTS ${JSON.stringify(options.slots)}`);
  }
  if (options.booking) parts.push(`BOOKING_READY ${JSON.stringify(options.booking)}`);
  if (options.reschedule) parts.push(`RESCHEDULE_READY ${JSON.stringify(options.reschedule)}`);
  return parts.join("\n\n");
}
