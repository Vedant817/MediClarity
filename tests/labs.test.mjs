import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLab, parseJsonArray } from "../src/lib/labs.ts";

test("normalizes an alias and analyte-specific glucose units while retaining provenance", () => {
  const lab = normalizeLab({
    test: "FBS",
    value: 180,
    unit: "mg/dL",
    refMin: 70,
    refMax: 99,
    sourceLab: "Example Lab",
    sourceCountry: "IN",
    reportDate: "2026-08-20",
  });

  assert.equal(lab.canonicalName, "Glucose");
  assert.equal(lab.unit, "mmol/L");
  assert.ok(Math.abs(lab.value - 9.9899) < 0.001);
  assert.equal(lab.flag, "high");
  assert.equal(lab.original.value, 180);
  assert.equal(lab.original.unit, "mg/dL");
  assert.equal(lab.referenceRangeSource, "lab_provided");
  assert.equal(lab.sourceLab, "Example Lab");
  assert.equal(lab.normalization.unitConverted, true);
});

test("does not invent normal status, ranges, aliases, or conversions", () => {
  const lab = normalizeLab({ test: "Novel Marker X", value: 4.2, unit: "widgets" });

  assert.equal(lab.canonicalName, "Novel Marker X");
  assert.equal(lab.flag, "unknown");
  assert.equal(lab.refMin, undefined);
  assert.equal(lab.loinc, undefined);
  assert.equal(lab.normalization.unitConverted, false);
  assert.equal(lab.referenceRangeSource, "not_provided");
});

test("rejects an ambiguous international date and uses the explicit fallback", () => {
  const fallback = new Date("2026-08-31T00:00:00.000Z");
  const lab = normalizeLab({ test: "Hb", value: 13, reportDate: "01/02/2026" }, fallback);
  assert.equal(lab.date.toISOString(), fallback.toISOString());
});

test("parses a fenced JSON array but rejects non-array output", () => {
  assert.deepEqual(parseJsonArray("```json\n[{\"test\":\"Hb\",\"value\":13}]\n```"), [{ test: "Hb", value: 13 }]);
  assert.throws(() => parseJsonArray("{\"test\":\"Hb\"}"), /JSON array/);
});

test("printed numeric range wins over an inconsistent extracted flag", () => {
  const lab = normalizeLab({ test: "Hemoglobin", value: 9, unit: "g/dL", refMin: 12, refMax: 15, flag: "normal" });
  assert.equal(lab.flag, "low");
});
