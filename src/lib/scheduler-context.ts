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
