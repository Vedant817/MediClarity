import test from "node:test";
import assert from "node:assert/strict";
import { resolvePublicVisualizations } from "../src/lib/anatomy/share-visualize.ts";

test("uses cached owner suggestions when present", () => {
  const out = resolvePublicVisualizations(
    {
      summary: "unrelated text",
      visualizations: [
        { organId: "kidney", subRegion: "cortex", relatedTo: "kidney health", confidence: 0.9, evidence: ["Lab: Creatinine (high)"], laterality: "unknown" },
        { organId: "pancreatic-fluke", subRegion: null, relatedTo: null, confidence: 0.9, evidence: ["x"], laterality: "unknown" },
      ],
    },
    [],
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].organId, "kidney");
});

test("falls back to deterministic mapping without cached data", () => {
  const out = resolvePublicVisualizations(
    { summary: "gastritis and acidity" },
    [{ canonicalName: "Hemoglobin", value: 10, flag: "low" }],
  );
  assert.ok(out.length > 0);
  assert.equal(out[0].organId, "stomach");
});

test("returns empty when nothing clears the floor, never calls LLM", () => {
  // No network, no model: pure function of cached-or-deterministic input.
  assert.deepEqual(resolvePublicVisualizations({ summary: "fasting samples collected" }, []), []);
  assert.deepEqual(resolvePublicVisualizations({ summary: null, visualizations: null }, []), []);
});
