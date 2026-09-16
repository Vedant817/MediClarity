import test from "node:test";
import assert from "node:assert/strict";
import { MODEL_REGISTRY } from "../src/lib/anatomy/registry.ts";
import { ORGAN_IDS } from "../src/lib/anatomy/types.ts";
import { stableModelScale } from "../src/lib/anatomy/viewer.ts";
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

test("stableModelScale fits flat and tall organs without a runtime viewport", () => {
  // Flat pancreas-like box is width-bound.
  assert.ok(Math.abs(stableModelScale({ x: 0.17, y: 0.057, z: 0.08 }) - 3 / 0.17) < 1e-9);
  // Tall kidney-like box is height-bound.
  assert.equal(stableModelScale({ x: 0.073, y: 0.125, z: 0.08 }), 14);
  // Deep models cannot clip when rotated.
  assert.equal(stableModelScale({ x: 1, y: 1, z: 2 }), 0.875);
});

test("stableModelScale never vanishes on bad input", () => {
  assert.equal(stableModelScale({ x: 0, y: 0, z: 0 }), 1);
  assert.equal(stableModelScale({ x: NaN, y: 1, z: 1 }), 1);
});
