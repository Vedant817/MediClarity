import test from "node:test";
import assert from "node:assert/strict";
import { MODEL_REGISTRY } from "../src/lib/anatomy/registry.ts";
import { ORGAN_IDS } from "../src/lib/anatomy/types.ts";
import { fitModelScale } from "../src/lib/anatomy/viewer.ts";
import {
  ORGAN_HIGHLIGHT_INFO,
  getHighlightMeaning,
  matchDrivingLabs,
} from "../src/lib/anatomy/highlight-info.ts";

test("every organ has highlight info", () => {
  for (const organId of ORGAN_IDS) {
    const info = ORGAN_HIGHLIGHT_INFO[organId];
    assert.ok(info, `missing highlight info for ${organId}`);
    assert.ok(info.summary.length > 20, `summary too short for ${organId}`);
    assert.ok(!/diagnos|you have|disease/i.test(`${info.summary} ${Object.values(info.regions).join(" ")}`),
      `diagnostic language for ${organId}`);
  }
});

test("every registered hotspot has a region meaning", () => {
  for (const organId of ORGAN_IDS) {
    for (const key of Object.keys(MODEL_REGISTRY[organId].hotspots)) {
      const meaning = ORGAN_HIGHLIGHT_INFO[organId].regions[key];
      assert.ok(meaning && meaning.length > 20, `missing region meaning for ${organId}/${key}`);
    }
  }
});

test("getHighlightMeaning falls back to the organ summary", () => {
  assert.equal(getHighlightMeaning("kidney", "cortex"), ORGAN_HIGHLIGHT_INFO.kidney.regions.cortex);
  assert.equal(getHighlightMeaning("kidney", "no-such-region"), ORGAN_HIGHLIGHT_INFO.kidney.summary);
});

test("matchDrivingLabs matches abnormal labs quoted in evidence", () => {
  const labs = [
    { test: "Creatinine, Serum", value: 1.9, unit: "mg/dL", flag: "high" },
    { test: "eGFR", value: 38, unit: "mL/min", flag: "low" },
    { test: "Sodium, Serum", value: 139, unit: "mmol/L", flag: "normal" },
  ];
  const matched = matchDrivingLabs(labs, ["Creatinine 1.9 mg/dL", "eGFR 38"]);
  assert.deepEqual(matched.map((lab) => lab.test), ["Creatinine, Serum", "eGFR"]);
});

test("matchDrivingLabs never shows normal labs and never matches without evidence", () => {
  const labs = [
    { test: "Sodium, Serum", value: 139, unit: "mmol/L", flag: "normal" },
    { test: "Creatinine, Serum", value: 1.9, unit: "mg/dL", flag: "high" },
  ];
  assert.deepEqual(matchDrivingLabs(labs, ["Sodium 139"]), []);
  assert.deepEqual(matchDrivingLabs(labs, []), []);
  assert.deepEqual(matchDrivingLabs(undefined, ["Creatinine"]), []);
});

test("matchDrivingLabs handles short spans and avoids false positives", () => {
  const labs = [
    { test: "TSH", value: 9.4, unit: "uIU/mL", flag: "high" },
    { test: "Hemoglobin", value: 13.2, unit: "g/dL", flag: "normal" },
  ];
  assert.deepEqual(matchDrivingLabs(labs, ["TSH 9.4"]).map((lab) => lab.test), ["TSH"]);
  assert.deepEqual(matchDrivingLabs(labs, ["patient feels tired"]), []);
});

test("fitModelScale fills the tighter axis (flat organs use width, tall use height)", () => {
  // Flat pancreas-like box in a wide panel: width binds.
  assert.ok(Math.abs(fitModelScale({ x: 0.17, y: 0.057 }, { width: 4.7, height: 2.47 }) - (4.7 * 0.85) / 0.17) < 1e-9);
  // Tall kidney-like box: height binds.
  assert.ok(Math.abs(fitModelScale({ x: 0.073, y: 0.125 }, { width: 4.7, height: 2.47 }) - (2.47 * 0.85) / 0.125) < 1e-9);
  // Square box in a square viewport fills 85% both ways.
  assert.equal(fitModelScale({ x: 2, y: 2 }, { width: 4, height: 4 }), 1.7);
});

test("fitModelScale never vanishes on bad input", () => {
  assert.equal(fitModelScale({ x: 0, y: 0 }, { width: 4, height: 4 }), 1);
  assert.equal(fitModelScale({ x: 1, y: 1 }, { width: 0, height: 0 }), 1);
  assert.equal(fitModelScale({ x: NaN, y: 1 }, { width: 4, height: 4 }), 1);
});
