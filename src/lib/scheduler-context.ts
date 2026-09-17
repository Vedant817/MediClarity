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

export type SchedulerTag = "SUGGESTED_DOCTORS" | "BOOKING_READY";

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
  let result = message;
  for (const tag of ["SUGGESTED_DOCTORS", "BOOKING_READY"] as const) {
    let span = taggedJsonSpan(result, tag);
    while (span) {
      result = `${result.slice(0, span.start)}${result.slice(span.end)}`;
      span = taggedJsonSpan(result, tag);
    }
    result = result.replaceAll(tag, "");
  }
  return result
    .split("\n")
    .filter((line) => !/^\s*```(?:json)?\s*$/i.test(line))
    .join("\n");
}

export function replaceRelativeSchedulerDates(response: string, currentDate: string): string {
  const explicitDate = response.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? currentDate;
  return response.replace(/\b(?:today|tomorrow)\b/gi, `on ${explicitDate}`);
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
