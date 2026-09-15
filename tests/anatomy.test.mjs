import test from "node:test";
import assert from "node:assert/strict";
import { suggestOrgans } from "../src/lib/anatomy/organ-keywords.ts";
import { getOrganModel, MODEL_REGISTRY, registeredOrganIds } from "../src/lib/anatomy/registry.ts";
import {
  MAX_VISUALIZATIONS_PER_REPORT,
  MIN_VISUALIZATION_CONFIDENCE,
  ORGAN_IDS,
  visualizationSuggestionSchema,
} from "../src/lib/anatomy/types.ts";

test("kidney panel maps to kidney with high confidence", () => {
  const out = suggestOrgans(
    [
      { canonicalName: "Creatinine", value: 1.9, flag: "high" },
      { canonicalName: "eGFR", value: 38, flag: "low" },
    ],
    "Routine metabolic panel.",
  );
  assert.ok(out.length > 0);
  assert.equal(out[0].organId, "kidney");
  assert.ok(out[0].confidence >= MIN_VISUALIZATION_CONFIDENCE);
  assert.ok(out[0].evidence.some((e) => /creatinine/i.test(e)));
});

test("liver enzymes map to liver; gastritis text maps to stomach", () => {
  const liver = suggestOrgans([{ canonicalName: "ALT", value: 98, flag: "high" }], "");
  assert.equal(liver[0]?.organId, "liver");

  const stomach = suggestOrgans([], "Patient reports acidity and gastritis with epigastric pain.");
  assert.equal(stomach[0]?.organId, "stomach");
  assert.equal(stomach[0]?.subRegion, "lining");
});

test("respiratory and neuro keywords resolve without substring false hits", () => {
  const sinus = suggestOrgans([], "Congestion and sneezing for three days.");
  assert.equal(sinus[0]?.organId, "nose-sinus");

  const head = suggestOrgans([], "Recurrent migraine and headache.");
  assert.equal(head[0]?.organId, "brain");

  // "hearth" must not trigger the heart keyword (word-boundary matching).
  const none = suggestOrgans([], "The stone hearth was cold.");
  assert.deepEqual(none, []);
});

test("unknown content returns no suggestions instead of hallucinating", () => {
  assert.deepEqual(suggestOrgans([], "Fasting samples collected in the morning."), []);
  assert.deepEqual(suggestOrgans([{ canonicalName: "Mystery Analyte", value: 1 }], ""), []);
  assert.deepEqual(suggestOrgans(null, null), []);
});

test("short tokens match whole words only", () => {
  // "ast" in "fasting", "alt" in "cobalt"/"health"/"salt" must not fire.
  assert.deepEqual(suggestOrgans([{ canonicalName: "Fasting Glucose", flag: "high" }], "").map((s) => s.organId), ["pancreas"]);
  assert.deepEqual(suggestOrgans([{ canonicalName: "Cobalt", flag: "high" }], ""), []);
  assert.deepEqual(suggestOrgans([{ canonicalName: "Salt", flag: "high" }], ""), []);
  // The stone hearth test from review.
  assert.deepEqual(suggestOrgans([], "The stone hearth was cold."), []);
});

test("short tokens tolerate printed plurals", () => {
  assert.equal(suggestOrgans([{ canonicalName: "LDLs", flag: "high" }], "")[0]?.organId, "heart");
  assert.equal(suggestOrgans([{ canonicalName: "TSHs", flag: "high" }], "")[0]?.organId, "thyroid");
  assert.equal(
    suggestOrgans(
      [
        { canonicalName: "RBCs", flag: "low" },
        { canonicalName: "Hemoglobin", flag: "low" },
      ],
      "",
    )[0]?.organId,
    "heart",
  );
});

test("overlapping aliases count once per organ per test", () => {
  const ft3 = suggestOrgans([{ canonicalName: "FT3", value: 9, flag: "high" }], "");
  assert.equal(ft3.length, 1);
  assert.equal(ft3[0].organId, "thyroid");
  assert.equal(ft3[0].confidence, 0.75);
  // Repeat identical labs do not inflate the score.
  const twice = suggestOrgans(
    [
      { canonicalName: "Creatinine", value: 2, flag: "high" },
      { canonicalName: "Creatinine", value: 2.1, flag: "high" },
    ],
    "",
  );
  const once = suggestOrgans([{ canonicalName: "Creatinine", value: 2, flag: "high" }], "");
  assert.deepEqual(twice.map((s) => s.confidence), once.map((s) => s.confidence));
});

test("normal labs contribute nothing; lone weak labs stay hidden", () => {
  assert.deepEqual(
    suggestOrgans(
      [
        { canonicalName: "Hemoglobin", value: 14, flag: "normal" },
        { canonicalName: "TSH", value: 2, flag: "normal" },
      ],
      "",
    ),
    [],
  );
  // Isolated low Vitamin D / high CRP are too nonspecific to illustrate.
  assert.deepEqual(suggestOrgans([{ canonicalName: "Vitamin D", value: 18, flag: "low" }], ""), []);
  assert.deepEqual(suggestOrgans([{ canonicalName: "CRP", value: 30, flag: "high" }], ""), []);
  // But a strong specific lab alone still shows.
  const tsh = suggestOrgans([{ canonicalName: "TSH", value: 9, flag: "high" }], "");
  assert.equal(tsh[0]?.organId, "thyroid");
});

test("single solid keyword clears the floor; plurals and heartburn work", () => {
  const headache = suggestOrgans([], "Headache since morning.");
  assert.equal(headache[0]?.organId, "brain");
  assert.ok(headache[0].confidence >= MIN_VISUALIZATION_CONFIDENCE);
  assert.equal(suggestOrgans([], "Lungs clear, coughing all night.")[0]?.organId, "lung");
  const pluralHits = suggestOrgans([], "Kidneys aching, ulcers bothering me.").map((s) => s.organId);
  assert.ok(pluralHits.includes("kidney"), `kidney missing from ${pluralHits}`);
  assert.ok(pluralHits.includes("stomach"), `stomach missing from ${pluralHits}`);
  const heartburn = suggestOrgans([], "I have heartburn every night.");
  assert.equal(heartburn[0]?.organId, "stomach");
  assert.equal(heartburn[0]?.subRegion, "fundus");
});

test("topic and region travel as the winning pair", () => {
  const stone = suggestOrgans([], "kidney pain, suspected kidney stone");
  assert.equal(stone[0]?.organId, "kidney");
  assert.equal(stone[0]?.relatedTo, "kidney health");
  assert.equal(stone[0]?.subRegion, "pelvis");
  // Higher-weight gastritis beats earlier weaker acidity, as a pair.
  const gastritis = suggestOrgans([], "Burning stomach pain, acidity, diagnosed gastritis");
  assert.equal(gastritis[0]?.relatedTo, "stomach-lining health");
  assert.equal(gastritis[0]?.subRegion, "lining");
});

test("evidence is capped so the schema contract always holds", () => {
  const longName = `X${"y".repeat(500)}`;
  const out = suggestOrgans([{ canonicalName: `Creatinine ${longName}`, value: 2, flag: "high" }], "");
  assert.ok(out.length > 0);
  for (const suggestion of out) {
    assert.equal(visualizationSuggestionSchema.safeParse(suggestion).success, true);
    for (const line of suggestion.evidence) assert.ok(line.length <= 200);
  }
});

test("caps suggestions at three, highest confidence first", () => {
  const out = suggestOrgans(
    [
      { canonicalName: "Creatinine", value: 2, flag: "high" },
      { canonicalName: "ALT", value: 120, flag: "high" },
      { canonicalName: "TSH", value: 9, flag: "high" },
      { canonicalName: "Glucose", value: 300, flag: "high" },
      { canonicalName: "Hemoglobin", value: 9, flag: "low" },
    ],
    "gastritis acidity sinus congestion headache thyroid diabetes",
  );
  assert.ok(out.length <= MAX_VISUALIZATIONS_PER_REPORT);
  for (let i = 1; i < out.length; i += 1) {
    assert.ok(out[i - 1].confidence >= out[i].confidence);
  }
  for (const suggestion of out) {
    assert.equal(visualizationSuggestionSchema.safeParse(suggestion).success, true);
  }
});

test("registry covers the full taxonomy with licenses and hotspots", () => {
  assert.deepEqual([...registeredOrganIds()].sort(), [...ORGAN_IDS].sort());
  for (const organId of ORGAN_IDS) {
    const entry = getOrganModel(organId);
    assert.ok(entry.glb.length > 0, `${organId} missing glb`);
    assert.ok(entry.fallbackGlb.startsWith("/models/"), `${organId} fallback must be local`);
    assert.ok(entry.license.length > 0, `${organId} missing license`);
    assert.ok(entry.attribution.length > 0, `${organId} missing attribution`);
    assert.ok(Object.keys(entry.hotspots).length > 0, `${organId} missing hotspots`);
    for (const hotspot of Object.values(entry.hotspots)) {
      assert.equal(hotspot.position.length, 3);
      assert.ok(hotspot.position.every((n) => Number.isFinite(n)));
    }
  }
});
