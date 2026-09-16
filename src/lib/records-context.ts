export type RecordContextInput = {
  /** The report open when the session started (richest detail, incl. OCR). */
  currentSummary?: string | null;
  currentOcr?: string | null;
  /** Older reports, newest first. Summary only — keeps the prompt bounded. */
  pastReports?: Array<{ date?: string | Date | null; summary?: string | null }>;
  abnormalLabs?: Array<{
    canonicalName?: string;
    test?: string;
    value?: number | string | null;
    unit?: string | null;
    flag?: string | null;
    date?: string | Date | null;
  }>;
  medications?: Array<{ name?: string | null; dose?: string | null; frequency?: string | null }>;
  upcomingAppointments?: Array<{
    providerId?: string | null;
    date?: string | Date | null;
    time?: string | null;
    reason?: string | null;
  }>;
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "undated";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "undated";
  return parsed.toISOString().slice(0, 10);
}

function clip(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Compose the patient-record context for records chat. The current report
 * comes first at full detail; history follows as dated excerpts so the
 * assistant can answer "what was my X" from ANY past report and say which
 * report the answer came from. Bounded output: callers stay well inside
 * model limits regardless of record size.
 */
export function buildRecordContext(input: RecordContextInput): string {
  const sections: string[] = [];

  const current = (input.currentSummary ?? "").trim();
  if (current) {
    sections.push(`CURRENT REPORT:\n${clip(current, 6000)}`);
  }
  const currentOcr = (input.currentOcr ?? "").trim();
  if (currentOcr) {
    sections.push(`CURRENT REPORT OCR (verbatim lab text):\n${clip(currentOcr, 20_000)}`);
  }

  const past = (input.pastReports ?? [])
    .map((report) => ({ date: formatDate(report.date), summary: (report.summary ?? "").trim() }))
    .filter((report) => report.summary.length > 0)
    .slice(0, 5);
  if (past.length > 0) {
    sections.push(
      `PAST REPORTS (newest first, summaries):\n${past
        .map((report, index) => `[Past report ${index + 1} · ${report.date}]\n${clip(report.summary, 2500)}`)
        .join("\n\n")}`,
    );
  }

  const labs = (input.abnormalLabs ?? [])
    .filter((lab) => lab && (lab.canonicalName || lab.test))
    .slice(0, 15);
  if (labs.length > 0) {
    sections.push(
      `ABNORMAL LABS ACROSS RECORDS:\n${labs
        .map(
          (lab) =>
            `- ${lab.canonicalName || lab.test}: ${lab.value ?? "?"} ${lab.unit ?? ""}`.trim() +
            ` [${lab.flag ?? "unknown"}, ${formatDate(lab.date)}]`,
        )
        .join("\n")}`,
    );
  }

  const meds = (input.medications ?? [])
    .map((med) => [med.name, med.dose, med.frequency].filter(Boolean).join(" "))
    .filter((line) => line.length > 0)
    .slice(0, 20);
  if (meds.length > 0) {
    sections.push(`ACTIVE MEDICATIONS:\n${meds.map((line) => `- ${line}`).join("\n")}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (input.upcomingAppointments ?? [])
    .filter((appointment) => appointment && (appointment.providerId || appointment.reason))
    .slice(0, 5);
  if (upcoming.length > 0) {
    sections.push(
      `UPCOMING APPOINTMENTS (today is ${today}):\n${upcoming
        .map(
          (appointment) =>
            `- ${appointment.providerId || "Provider"} on ${formatDate(appointment.date)}${appointment.time ? ` at ${appointment.time}` : ""}${appointment.reason ? `: ${appointment.reason}` : ""}`,
        )
        .join("\n")}`,
    );
  }

  return sections.join("\n\n") || "No report context was saved for this conversation.";
}
