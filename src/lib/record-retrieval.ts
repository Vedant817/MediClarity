import { mentionsKnownLab } from "./labs.ts";

export type ReportIndexEntry = {
  id: string;
  date: string;
  sourceLab?: string | null;
  createdAt?: string | Date | null;
  reportDate?: string | Date | null;
};

export type CatalogReport = ReportIndexEntry & {
  indexFromOldest: number;
  indexFromNewest: number;
  total: number;
  label: string;
};

export type RecordScope =
  | { type: "latest" }
  | { type: "oldest" }
  | { type: "last_n"; n: number }
  | { type: "first_n"; n: number }
  | { type: "nth_newest"; n: number }
  | { type: "ends" }
  | { type: "date"; year: number; month?: number; day?: number }
  | { type: "all" }
  | { type: "unspecified" };

export type RecordQuestionIntent = {
  scope: RecordScope;
  compare: boolean;
  includeLabHistory: boolean;
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9,
  sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

const NUMBER_WORDS: Record<string, number> = {
  two: 2, couple: 2, both: 2, few: 3, three: 3, four: 4, five: 5,
};

function toIsoDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function parseCount(raw: string): number {
  const word = NUMBER_WORDS[raw.toLowerCase()];
  if (word) return word;
  const numeric = Number.parseInt(raw, 10);
  if (Number.isFinite(numeric)) return Math.min(10, Math.max(1, numeric));
  return 2;
}

export function reportSortDate(report: { reportDate?: string | Date | null; createdAt?: string | Date | null }): string {
  return toIsoDate(report.reportDate) || toIsoDate(report.createdAt) || "9999-12-31";
}

export function buildReportCatalog(reports: ReportIndexEntry[]): CatalogReport[] {
  const sorted = [...reports].sort((left, right) => {
    const byDate = reportSortDate(left).localeCompare(reportSortDate(right));
    if (byDate !== 0) return byDate;
    return String(left.id).localeCompare(String(right.id));
  });
  const total = sorted.length;
  return sorted.map((report, index) => {
    const indexFromOldest = index + 1;
    const indexFromNewest = total - index;
    const date = reportSortDate(report);
    let label = `Report ${indexFromOldest} of ${total}`;
    if (indexFromOldest === 1) label = "FIRST-EVER";
    if (indexFromNewest === 1) label = "MOST RECENT";
    if (indexFromNewest === 2 && total > 2) label = "SECOND MOST RECENT";
    if (indexFromOldest === 1 && indexFromNewest === 1) label = "ONLY REPORT";
    return {
      ...report,
      date,
      indexFromOldest,
      indexFromNewest,
      total,
      label,
    };
  });
}

export function parseRecordQuestion(question: string): RecordQuestionIntent {
  const text = question.toLowerCase().replace(/[’']/g, "'");
  const compare = /\b(compar(?:e|ing|ison)|versus|\bvs\.?\b|difference|differ|changed?|trend|over time|across (?:my )?reports?)\b/.test(text);
  const includeLabHistory = compare || mentionsKnownLab(question) || /\b(all|every|history|trend|over time)\b/.test(text);

  const lastN = text.match(/\b(?:last|latest|recent|previous)\s+(two|three|four|five|couple|few|both|\d+)(?:\s+reports?)?\b/);
  if (lastN) {
    return { scope: { type: "last_n", n: parseCount(lastN[1]) }, compare: compare || parseCount(lastN[1]) > 1, includeLabHistory: true };
  }

  const firstN = text.match(/\b(?:first|oldest|earliest)\s+(two|three|four|five|\d+)\s+reports?\b/);
  if (firstN) return { scope: { type: "first_n", n: parseCount(firstN[1]) }, compare, includeLabHistory };

  if (/\b(second[- ]?(?:to[- ]?)?last|2nd[- ]?(?:to[- ]?)?last|second most recent|penultimate|previous report|report before(?: the)? last|before (?:the )?last)\b/.test(text)) {
    return { scope: { type: "nth_newest", n: 2 }, compare, includeLabHistory };
  }
  if (/\b(third[- ]?(?:to[- ]?)?last|3rd[- ]?(?:to[- ]?)?last|third most recent)\b/.test(text)) {
    return { scope: { type: "nth_newest", n: 3 }, compare, includeLabHistory };
  }

  if (/\b(first[- ]ever(?: report)?|first(?:-ever)? report|oldest(?: report)?|earliest(?: report)?|very first report|initial report|first one I)\b/.test(text)
    && !/\bfirst (?:two|three|four|five|\d+)\b/.test(text)) {
    return { scope: { type: "oldest" }, compare, includeLabHistory };
  }

  if (/\b(most recent|latest(?: report)?|last report|newest(?: report)?|current report)\b/.test(text)) {
    return { scope: { type: "latest" }, compare, includeLabHistory };
  }

  if (/\b(first and last|oldest and newest|first and most recent|earliest and latest)\b/.test(text)) {
    return { scope: { type: "ends" }, compare: true, includeLabHistory: true };
  }

  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return { scope: { type: "date", year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }, compare, includeLabHistory };
  }

  const monthYear = text.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\w*\s+(20\d{2})\b/);
  if (monthYear) {
    return { scope: { type: "date", year: Number(monthYear[2]), month: MONTHS[monthYear[1]] }, compare, includeLabHistory };
  }

  const yearOnly = text.match(/\b(?:in |from |during )?(20\d{2})\b/);
  if (yearOnly && /\b(report|reports|labs?|results?)\b/.test(text)) {
    return { scope: { type: "date", year: Number(yearOnly[1]) }, compare, includeLabHistory };
  }

  if (/\b(all reports|every report|entire (?:record|history)|whole (?:record|history)|every (?:lab|result))\b/.test(text)) {
    return { scope: { type: "all" }, compare: true, includeLabHistory: true };
  }

  if (compare) return { scope: { type: "last_n", n: 2 }, compare: true, includeLabHistory: true };
  return { scope: { type: "unspecified" }, compare: false, includeLabHistory };
}

export function selectReports(catalog: CatalogReport[], intent: RecordQuestionIntent): CatalogReport[] {
  if (catalog.length === 0) return [];
  const newestFirst = [...catalog].sort((left, right) => left.indexFromNewest - right.indexFromNewest);
  const oldestFirst = catalog;
  const { scope } = intent;

  if (scope.type === "latest" || scope.type === "unspecified") return [newestFirst[0]];
  if (scope.type === "oldest") return [oldestFirst[0]];
  if (scope.type === "last_n") return newestFirst.slice(0, scope.n);
  if (scope.type === "first_n") return oldestFirst.slice(0, scope.n);
  if (scope.type === "nth_newest") return newestFirst.slice(scope.n - 1, scope.n);
  if (scope.type === "ends") {
    if (catalog.length === 1) return [catalog[0]];
    return [oldestFirst[0], newestFirst[0]];
  }
  if (scope.type === "all") return newestFirst.slice(0, 6);
  if (scope.type === "date") {
    return catalog.filter((report) => {
      const [year, month, day] = report.date.split("-").map(Number);
      if (year !== scope.year) return false;
      if (scope.month && month !== scope.month) return false;
      if (scope.day && day !== scope.day) return false;
      return true;
    });
  }
  return [newestFirst[0]];
}

export function describeScope(intent: RecordQuestionIntent): string {
  const { scope } = intent;
  if (scope.type === "latest") return "MOST RECENT report only";
  if (scope.type === "oldest") return "FIRST-EVER report only";
  if (scope.type === "last_n") return `LAST ${scope.n} reports (most recent first)`;
  if (scope.type === "first_n") return `FIRST ${scope.n} reports (oldest first)`;
  if (scope.type === "nth_newest") return scope.n === 2 ? "SECOND MOST RECENT report only" : `${scope.n}th most recent report only`;
  if (scope.type === "ends") return "FIRST-EVER and MOST RECENT reports";
  if (scope.type === "all") return "recent reports plus catalog of all dates";
  if (scope.type === "date") {
    const parts = [String(scope.year), scope.month ? String(scope.month).padStart(2, "0") : null, scope.day ? String(scope.day).padStart(2, "0") : null];
    return `reports dated ${parts.filter(Boolean).join("-")}`;
  }
  return "MOST RECENT report (question did not name another report)";
}

function clip(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type SelectedReportDetail = CatalogReport & {
  summary?: string | null;
  labs?: Array<{
    canonicalName?: string | null;
    test?: string | null;
    value?: number | string | null;
    unit?: string | null;
    flag?: string | null;
  }>;
};

export function formatScopedRecordContext(input: {
  catalog: CatalogReport[];
  selected: SelectedReportDetail[];
  intent: RecordQuestionIntent;
  medications?: Array<{ name?: string | null; dose?: string | null; frequency?: string | null }>;
  upcomingAppointments?: Array<{
    providerId?: string | null;
    date?: string | Date | null;
    time?: string | null;
    reason?: string | null;
  }>;
  labHistory?: Array<{
    canonicalName?: string | null;
    test?: string | null;
    value?: number | string | null;
    unit?: string | null;
    flag?: string | null;
    date?: string | Date | null;
  }>;
}): string {
  const sections: string[] = [];
  const total = input.catalog[0]?.total ?? input.catalog.length;

  if (input.catalog.length === 0) {
    return "REPORT CATALOG: the patient has no uploaded reports. Reply exactly: Not in report - ask your doctor";
  }

  sections.push(
    `REPORT CATALOG (authoritative; ${total} report${total === 1 ? "" : "s"}; oldest is FIRST-EVER, newest is MOST RECENT):\n${
      input.catalog.map((report) =>
        `- ${report.label} · ${report.date}${report.sourceLab ? ` · ${report.sourceLab}` : ""} (oldest #${report.indexFromOldest}, newest #${report.indexFromNewest})`
      ).join("\n")
    }`,
  );
  sections.push(`QUESTION SCOPE: ${describeScope(input.intent)}`);

  if (input.selected.length === 0) {
    sections.push("SELECTED REPORTS: none match this question. Reply exactly: Not in report - ask your doctor");
  } else {
    const details = input.selected.map((report) => {
      const labs = (report.labs ?? [])
        .filter((lab) => lab.canonicalName || lab.test)
        .slice(0, 40)
        .map((lab) =>
          `- ${lab.canonicalName || lab.test}: ${lab.value ?? "?"} ${lab.unit ?? ""} [${lab.flag ?? "unknown"}]`.replace(/\s+/g, " ").trim()
        );
      const summary = clip((report.summary ?? "").trim() || "No summary stored.", 3_500);
      return `[${report.label} · ${report.date}${report.sourceLab ? ` · ${report.sourceLab}` : ""}]\n${summary}${
        labs.length ? `\nLabs:\n${labs.join("\n")}` : ""
      }`;
    });
    sections.push(`SELECTED REPORT DETAIL (answer ONLY from these unless the question is how many reports exist):\n${details.join("\n\n")}`);
  }

  if (input.intent.includeLabHistory && input.labHistory && input.labHistory.length > 0) {
    sections.push(
      `LAB HISTORY (dated; use when the question asks what changed or for a named test across time):\n${
        input.labHistory.slice(0, 80).map((lab) =>
          `- ${toIsoDate(lab.date) || "undated"} · ${lab.canonicalName || lab.test}: ${lab.value ?? "?"} ${lab.unit ?? ""} [${lab.flag ?? "unknown"}]`.replace(/\s+/g, " ").trim()
        ).join("\n")
      }`,
    );
  }

  const meds = (input.medications ?? [])
    .map((med) => [med.name, med.dose, med.frequency].filter(Boolean).join(" "))
    .filter(Boolean)
    .slice(0, 20);
  if (meds.length > 0) sections.push(`ACTIVE MEDICATIONS:\n${meds.map((line) => `- ${line}`).join("\n")}`);

  const upcoming = (input.upcomingAppointments ?? []).filter((appointment) => appointment.providerId || appointment.reason).slice(0, 5);
  if (upcoming.length > 0) {
    sections.push(
      `UPCOMING APPOINTMENTS:\n${upcoming.map((appointment) =>
        `- ${appointment.providerId || "Provider"} on ${toIsoDate(appointment.date) || "undated"}${appointment.time ? ` at ${appointment.time}` : ""}${appointment.reason ? `: ${appointment.reason}` : ""}`
      ).join("\n")}`,
    );
  }

  sections.push(
    "CITATION RULES: Name the report label and ISO date for every value. Never attach a number from MOST RECENT when the question asked for FIRST-EVER, or from an older report when the question asked for the last report. If the fact is not in SELECTED REPORT DETAIL (or LAB HISTORY when provided), say exactly: Not in report - ask your doctor",
  );

  return sections.join("\n\n");
}
