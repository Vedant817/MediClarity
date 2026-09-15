import test from "node:test";
import assert from "node:assert/strict";
import {
  needsLlmSecondPass,
  refineOrgansWithLLM,
  resolveVisualizations,
} from "../src/lib/anatomy/organ-llm.ts";

const strong = [
  {
    organId: "kidney",
    subRegion: "cortex",
    relatedTo: "kidney health",
    confidence: 1,
    evidence: ["Lab: Creatinine (high)"],
    laterality: "unknown",
  },
];

const weak = [
  {
    organId: "heart",
    subRegion: null,
    relatedTo: null,
    confidence: 0.5,
    evidence: ["Lab: Hemoglobin (low)"],
    laterality: "unknown",
  },
];

test("skips the LLM pass when deterministic evidence is strong", () => {
  assert.equal(needsLlmSecondPass(strong), false);
  assert.equal(needsLlmSecondPass(weak), true);
  assert.equal(needsLlmSecondPass([]), true);
});

test("uses deterministic results directly when confident", async () => {
  let refineCalls = 0;
  const out = await resolveVisualizations({
    deterministic: strong,
    refine: () => {
      refineCalls += 1;
      return Promise.resolve([]);
    },
  });
  assert.deepEqual(out, { suggestions: strong, usedLlm: false });
  assert.equal(refineCalls, 0);
});

test("falls back to deterministic results when refinement fails", async () => {
  const failing = await resolveVisualizations({
    deterministic: weak,
    refine: () => Promise.reject(new Error("429")),
  });
  assert.deepEqual(failing.suggestions, weak);
  assert.equal(failing.usedLlm, false);

  const empty = await resolveVisualizations({
    deterministic: weak,
    refine: () => Promise.resolve([]),
  });
  assert.deepEqual(empty.suggestions, weak);
  assert.equal(empty.usedLlm, false);
});

test("parses constrained LLM output and drops off-taxonomy organs", async () => {
  const out = await refineOrgansWithLLM(
    "creatinine high",
    () =>
      Promise.resolve(
        JSON.stringify([
          { organId: "kidney", subRegion: "cortex", relatedTo: "kidney health", confidence: 0.8, evidence: ["creatinine high"], laterality: "unknown" },
          { organId: "pancreatic-fluke", subRegion: null, relatedTo: null, confidence: 0.9, evidence: ["x"], laterality: "unknown" },
        ]),
      ),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].organId, "kidney");
});

test("rejects non-array model output", async () => {
  await assert.rejects(refineOrgansWithLLM("text", () => Promise.resolve("no json here")));
});
