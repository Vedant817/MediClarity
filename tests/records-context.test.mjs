import test from "node:test";
import assert from "node:assert/strict";
import { buildRecordContext } from "../src/lib/records-context.ts";

test("combines current detail with dated history", () => {
  const out = buildRecordContext({
    currentSummary: "Kidney panel summary here.",
    currentOcr: "Creatinine 1.9",
    pastReports: [
      { date: "2026-06-10", summary: "CBC summary with hemoglobin 10.8." },
      { date: "2026-05-01", summary: "Old summary." },
    ],
  });
  assert.ok(out.includes("CURRENT REPORT:"));
  assert.ok(out.includes("[Past report 1 · 2026-06-10]"));
  assert.ok(out.includes("hemoglobin 10.8"));
  assert.ok(out.indexOf("CURRENT REPORT") < out.indexOf("PAST REPORTS"));
});

test("lists upcoming appointments with provider and date", () => {
  const out = buildRecordContext({
    upcomingAppointments: [
      { providerId: "dr-davis", date: "2026-09-21", time: "09:00", reason: "Check-up visit" },
    ],
  });
  assert.ok(out.includes("UPCOMING APPOINTMENTS"));
  assert.ok(out.includes("dr-davis on 2026-09-21 at 09:00"));
  assert.equal(buildRecordContext({ upcomingAppointments: [] }).includes("UPCOMING"), false);
});

test("lists abnormal labs and medications compactly", () => {  const out = buildRecordContext({
    abnormalLabs: [
      { canonicalName: "Creatinine", value: 1.9, unit: "mg/dL", flag: "high", date: "2026-07-05" },
    ],
    medications: [{ name: "Atorvastatin", dose: "10mg", frequency: "once daily" }],
  });
  assert.ok(out.includes("ABNORMAL LABS ACROSS RECORDS:"));
  assert.ok(out.includes("Creatinine: 1.9 mg/dL [high, 2026-07-05]"));
  assert.ok(out.includes("- Atorvastatin 10mg once daily"));
});

test("bounds output and degrades to the empty notice", () => {
  assert.equal(
    buildRecordContext({}),
    "No report context was saved for this conversation.",
  );
  const big = "word ".repeat(50_000);
  const out = buildRecordContext({ currentSummary: big });
  assert.ok(out.length < 10_000, `unbounded: ${out.length}`);
  const many = Array.from({ length: 30 }, (_, i) => ({ date: "2026-01-01", summary: `report ${i} abcdef` }));
  const capped = buildRecordContext({ pastReports: many });
  assert.ok(!capped.includes("report 29"), "past reports must cap at 5");
});
