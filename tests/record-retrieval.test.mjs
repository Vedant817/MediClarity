import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReportCatalog,
  describeScope,
  formatScopedRecordContext,
  parseRecordQuestion,
  selectReports,
} from "../src/lib/record-retrieval.ts";

function catalogFromDates(dates) {
  return buildReportCatalog(dates.map((date, index) => ({
    id: `r${index + 1}`,
    date,
    reportDate: date,
    sourceLab: `Lab ${index + 1}`,
  })));
}

const six = catalogFromDates([
  "2026-01-10",
  "2026-03-02",
  "2026-05-01",
  "2026-06-10",
  "2026-07-05",
  "2026-09-10",
]);

test("catalog labels first-ever and most recent from true date order", () => {
  assert.equal(six[0].label, "FIRST-EVER");
  assert.equal(six[0].date, "2026-01-10");
  assert.equal(six[5].label, "MOST RECENT");
  assert.equal(six[5].date, "2026-09-10");
  assert.equal(six[4].label, "SECOND MOST RECENT");
});

test("parses last two, most recent, and first-ever phrasings", () => {
  assert.deepEqual(parseRecordQuestion("I wanted to know about my results from the last two reports").scope, { type: "last_n", n: 2 });
  assert.deepEqual(parseRecordQuestion("what is in the most recent report?").scope, { type: "latest" });
  assert.deepEqual(parseRecordQuestion("tell me about my first-ever report").scope, { type: "oldest" });
  assert.deepEqual(parseRecordQuestion("what did my first report say").scope, { type: "oldest" });
  assert.deepEqual(parseRecordQuestion("last report hemoglobin").scope, { type: "latest" });
  assert.deepEqual(parseRecordQuestion("compare my last two reports").scope, { type: "last_n", n: 2 });
  assert.equal(parseRecordQuestion("compare my last two reports").compare, true);
  assert.deepEqual(parseRecordQuestion("the report before last").scope, { type: "nth_newest", n: 2 });
  assert.deepEqual(parseRecordQuestion("June 2026 labs").scope, { type: "date", year: 2026, month: 6 });
});

test("selects last two as the two newest, not the two oldest", () => {
  const selected = selectReports(six, parseRecordQuestion("results from the last two reports"));
  assert.deepEqual(selected.map((report) => report.date), ["2026-09-10", "2026-07-05"]);
  assert.ok(selected.every((report) => report.label !== "FIRST-EVER"));
});

test("selects first-ever as the oldest even when many newer reports exist", () => {
  const selected = selectReports(six, parseRecordQuestion("my first-ever report"));
  assert.equal(selected.length, 1);
  assert.equal(selected[0].date, "2026-01-10");
  assert.equal(selected[0].label, "FIRST-EVER");
});

test("selects most recent as the newest dated report", () => {
  const selected = selectReports(six, parseRecordQuestion("the most recent report"));
  assert.equal(selected[0].date, "2026-09-10");
  assert.equal(selected[0].label, "MOST RECENT");
});

test("unspecified questions default to most recent so values are not pulled from older reports", () => {
  const selected = selectReports(six, parseRecordQuestion("what is my hemoglobin?"));
  assert.equal(selected.length, 1);
  assert.equal(selected[0].label, "MOST RECENT");
});

test("scoped context omits unselected report summaries", () => {
  const intent = parseRecordQuestion("last two reports");
  const selected = selectReports(six, intent).map((report) => ({
    ...report,
    summary: report.date === "2026-09-10" ? "Latest hemoglobin 13.2" : "July hemoglobin 10.8",
  }));
  const out = formatScopedRecordContext({ catalog: six, selected, intent });
  assert.match(out, /QUESTION SCOPE: LAST 2 reports/);
  assert.match(out, /MOST RECENT · 2026-09-10/);
  assert.match(out, /Latest hemoglobin 13.2/);
  assert.match(out, /July hemoglobin 10.8/);
  assert.doesNotMatch(out, /2026-01-10\]/);
  assert.match(out, /FIRST-EVER · 2026-01-10/);
  assert.equal(describeScope(intent), "LAST 2 reports (most recent first)");
});

test("no matching dated report forces the not-in-report instruction", () => {
  const intent = parseRecordQuestion("what about my 2024 reports");
  const selected = selectReports(six, intent);
  assert.equal(selected.length, 0);
  const out = formatScopedRecordContext({ catalog: six, selected, intent });
  assert.match(out, /Not in report - ask your doctor/);
});

test("empty catalog does not invent reports", () => {
  const intent = parseRecordQuestion("most recent report");
  assert.deepEqual(selectReports([], intent), []);
  assert.match(formatScopedRecordContext({ catalog: [], selected: [], intent }), /no uploaded reports/i);
});
