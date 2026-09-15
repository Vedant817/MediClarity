import test from "node:test";
import assert from "node:assert/strict";
import { parseLabsLenient } from "../src/lib/lab-extraction.ts";

const good = (overrides = {}) => ({
  test: "Hemoglobin",
  value: 10.8,
  unit: "g/dL",
  refMin: 13,
  refMax: 17,
  flag: "low",
  ...overrides,
});

test("keeps valid items when one item is malformed", () => {
  const out = parseLabsLenient(
    JSON.stringify([good(), { ...good({ test: "Weird" }), flag: "borderline" }, { test: "NoValue" }]),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].test, "Hemoglobin");
});

test("normalizes flag casing and whitespace", () => {
  const out = parseLabsLenient(JSON.stringify([good({ flag: " HIGH " }), good({ test: "B", flag: "Unknown" })]));
  assert.equal(out.length, 1);
  assert.equal(out[0].flag, "high");
});

test("throws when nothing usable comes back", () => {
  assert.throws(() => parseLabsLenient(JSON.stringify([{ test: "x" }])), /no valid lab/i);
  assert.throws(() => parseLabsLenient("no json here"), /JSON array/);
  assert.throws(() => parseLabsLenient(JSON.stringify({ test: "x" })), /JSON array/);
});

test("explicit empty array is valid without retry", () => {
  assert.deepEqual(parseLabsLenient("[]"), []);
  assert.deepEqual(parseLabsLenient("```json\n[]\n```"), []);
});
