import type { OrganId } from "./types.ts";

/**
 * Plain-language meanings for every highlighted sub-region, written to
 * patient-education rules (AHRQ/AAFP: short sentences, everyday words,
 * what the part DOES, 2–4 key points, visuals reinforce the message):
 *
 * - Educational only. Nothing here names a disease the patient has.
 * - Each region says what the part does + which lab topics are "often
 *   discussed with" it — the same framing as VISUALIZATION_COPY.
 * - Patterns borrowed from open-source anatomy viewers (all MIT unless
 *   noted): click-to-identify info pop-outs and landmark annotations
 *   (paulvanmetre/anatomy-viewer), organ-specific motion cues
 *   (yihalem123/Human-Organ3D), healthy-vs-diseased comparison framing
 *   (nadia-jelani/3d-Med, MIT). We deliberately do NOT generate fake
 *   pathology meshes: the verified HRA mesh (CC-BY 4.0) stays
 *   anatomically true and only the marker + words carry the meaning.
 */

export type HighlightInfo = {
  /** One line: what the organ does. */
  summary: string;
  /** subRegion key (registry hotspots) -> what the highlight means. */
  regions: Record<string, string>;
};

export const ORGAN_HIGHLIGHT_INFO: Record<OrganId, HighlightInfo> = {
  heart: {
    summary: "The heart pumps blood around the body.",
    regions: {
      ventricle:
        "Lower chambers that pump blood out to the body and lungs. Cholesterol and blood-pressure results are often discussed with how hard the heart works.",
      artery:
        "Tubes that carry blood away from the heart. Cholesterol results are often discussed with keeping these tubes clear.",
      circulation:
        "The loop blood travels around the body. Blood counts and cholesterol are often discussed with circulation.",
    },
  },
  lung: {
    summary: "The lungs move air in and out, swapping oxygen into the blood.",
    regions: {
      "lower-lobe":
        "Bottom sections of the lungs. Breathing and infection findings are often discussed with these areas.",
      bronchi:
        "Main airways branching into the lungs. Cough and breathing findings are often discussed with the airways.",
    },
  },
  kidney: {
    summary: "The kidneys filter waste from the blood into urine.",
    regions: {
      cortex:
        "Outer layer holding most of the tiny filters. Creatinine and eGFR results are often discussed with filtering.",
      nephron:
        "Tiny filtering units inside the kidney. Creatinine and eGFR results are often discussed with how filtering is going.",
      pelvis:
        "Funnel that collects urine toward the bladder. Kidney-stone topics are often discussed with this area.",
    },
  },
  liver: {
    summary: "The liver cleans blood, helps digestion, and stores energy.",
    regions: {
      "right-lobe":
        "Largest section of the liver. Liver enzyme results (ALT, AST, GGT) are often discussed with liver tissue.",
    },
  },
  stomach: {
    summary: "The stomach churns food and starts digestion with acid.",
    regions: {
      antrum:
        "Lower section that grinds food. Acidity and ulcer topics are often discussed with this area.",
      lining:
        "Inner surface touching food and acid. Acidity and irritation topics are often discussed with the lining.",
      fundus:
        "Upper dome that holds swallowed air and food. Reflux topics are often discussed with this area.",
    },
  },
  intestine: {
    summary: "The intestines absorb nutrients and water, moving waste along.",
    regions: {
      "large-intestine":
        "Final section absorbing water. Bowel-habit topics are often discussed with this area. The small bowel is not shown in this mesh.",
    },
  },
  pancreas: {
    summary: "The pancreas makes insulin for blood sugar and juices for digestion.",
    regions: {
      body: "Middle section of the gland. Blood-sugar topics are often discussed with the whole gland.",
      islets:
        "Tiny clusters that release insulin. Glucose and HbA1c results are often discussed with insulin.",
    },
  },
  brain: {
    summary: "The brain controls thought, movement, and the senses.",
    regions: {
      cortex:
        "Outer surface where thinking happens. Headache topics are discussed with the head generally — no mesh can show a headache.",
    },
  },
  thyroid: {
    summary: "A small gland in the neck that sets the body's energy pace.",
    regions: {
      lobe: "One side of the butterfly-shaped gland. TSH and thyroid-hormone results are often discussed with thyroid pace.",
    },
  },
  "nose-sinus": {
    summary: "Air passages that warm, moisten, and filter the air you breathe.",
    regions: {
      "nasal-cavity":
        "Main passage behind the nose. Congestion topics are often discussed with this passage.",
      "maxillary-sinus":
        "Air pockets in the cheeks. Sinus-pressure topics are often discussed with these pockets.",
    },
  },
  bladder: {
    summary: "The bladder stores urine until it leaves the body.",
    regions: {
      wall: "Muscular wall that stretches and squeezes. Urination topics are often discussed with the bladder wall.",
    },
  },
  spleen: {
    summary: "The spleen filters blood and helps fight germs.",
    regions: {
      body: "Main bulk of the organ. Blood-count topics are sometimes discussed with the spleen.",
    },
  },
};

/** Meaning for a resolved hotspot, falling back to the organ summary. */
export function getHighlightMeaning(organId: OrganId, subRegionKey: string): string {
  const info = ORGAN_HIGHLIGHT_INFO[organId];
  return info.regions[subRegionKey] ?? info.summary;
}

export function getOrganSummary(organId: OrganId): string {
  return ORGAN_HIGHLIGHT_INFO[organId].summary;
}

export type DrivingLab = {
  test: string;
  value: number | string;
  unit?: string | null;
  refMin?: number;
  refMax?: number;
  flag: string;
};

/** Deterministic prompts patients can take to a clinician; no diagnosis generation. */
export function buildDoctorQuestions(
  regionLabel: string,
  labs: DrivingLab[],
): string[] {
  if (labs.length > 0) {
    const names = labs.slice(0, 2).map((lab) => lab.test).join(" and ");
    return [
      `What do my ${names} results mean in the context of the rest of my report?`,
      "Should these results be repeated or monitored, and when?",
      "Could medicines, hydration, diet, or my medical history affect these results?",
    ];
  }
  return [
    `What does the report wording connected with the ${regionLabel} mean in my context?`,
    "Does this need follow-up, monitoring, or another test?",
    "Which symptoms should make me seek care sooner?",
  ];
}

/**
 * Which abnormal labs plausibly drive this illustration: an abnormal lab
 * whose (canonical) test name appears in — or contains — a quoted evidence
 * span from the report. Normal labs never drive; empty evidence never
 * matches. Conservative by design: no match means "no labs shown" rather
 * than a wrong attribution.
 */
export function matchDrivingLabs(
  labs: DrivingLab[] | undefined,
  evidence: string[],
): DrivingLab[] {
  if (!labs || labs.length === 0 || evidence.length === 0) return [];
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const specimenTokens = new Set(["arterial", "plasma", "serum", "venous"]);
  const spans = evidence.map(normalize);
  return labs.filter((lab) => {
    if (lab.flag !== "high" && lab.flag !== "low") return false;
    const name = normalize(lab.test);
    const analyteTokens = name
      .split(" ")
      .filter((token) => token.length >= 2 && !specimenTokens.has(token));
    return spans.some((span) => {
      if (span.length < 3 || name.length < 3) return false;
      if (span.includes(name)) return true;
      const spanTokens = new Set(span.split(" "));
      return analyteTokens.length > 0 && analyteTokens.every((token) => spanTokens.has(token));
    });
  });
}
