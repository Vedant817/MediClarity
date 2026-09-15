import {
  MAX_VISUALIZATIONS_PER_REPORT,
  MIN_VISUALIZATION_CONFIDENCE,
  ORGAN_IDS,
  type OrganId,
  type VisualizationSuggestion,
} from "./types.ts";

export type LabSignal = {
  /** Canonical lab name, e.g. "Hemoglobin" (matches labs.ts canonicalName). */
  canonicalName?: string;
  /** Raw printed test name as fallback. */
  test?: string;
  /** Numeric result; scoring ignores numerics, kept for caller convenience. */
  value?: number;
  flag?: "normal" | "high" | "low" | "unknown";
};

/**
 * Deterministic lab -> organ map. Labs are weighted higher than free text
 * because a printed measurement is stronger evidence than a stray word.
 * Canonical names mirror src/lib/labs.ts so extraction output plugs in
 * directly; matching is case-insensitive and substring-based.
 */
const LAB_TO_ORGAN: ReadonlyArray<{ match: string; organId: OrganId; weight: number }> = [
  // Kidney
  { match: "creatinine", organId: "kidney", weight: 3 },
  { match: "egfr", organId: "kidney", weight: 3 },
  { match: "e gfr", organId: "kidney", weight: 3 },
  { match: "urea", organId: "kidney", weight: 2 },
  { match: "bun", organId: "kidney", weight: 2 },
  { match: "albumin", organId: "kidney", weight: 1 },
  // Liver
  { match: "alt", organId: "liver", weight: 3 },
  { match: "sgpt", organId: "liver", weight: 3 },
  { match: "ast", organId: "liver", weight: 3 },
  { match: "sgot", organId: "liver", weight: 3 },
  { match: "alp", organId: "liver", weight: 2 },
  { match: "alkaline phosphatase", organId: "liver", weight: 2 },
  { match: "ggt", organId: "liver", weight: 3 },
  { match: "bilirubin", organId: "liver", weight: 3 },
  // Thyroid
  { match: "tsh", organId: "thyroid", weight: 3 },
  { match: "thyroid", organId: "thyroid", weight: 3 },
  { match: "t3", organId: "thyroid", weight: 2 },
  { match: "t4", organId: "thyroid", weight: 2 },
  { match: "ft3", organId: "thyroid", weight: 2 },
  { match: "ft4", organId: "thyroid", weight: 2 },
  // Heart / circulation
  { match: "ldl", organId: "heart", weight: 3 },
  { match: "hdl", organId: "heart", weight: 2 },
  { match: "cholesterol", organId: "heart", weight: 2 },
  { match: "triglyceride", organId: "heart", weight: 2 },
  { match: "troponin", organId: "heart", weight: 3 },
  { match: "ck-mb", organId: "heart", weight: 3 },
  { match: "bnp", organId: "heart", weight: 3 },
  { match: "nt-probnp", organId: "heart", weight: 3 },
  { match: "hemoglobin", organId: "heart", weight: 1 },
  { match: "haemoglobin", organId: "heart", weight: 1 },
  // Pancreas / glucose
  { match: "glucose", organId: "pancreas", weight: 3 },
  { match: "blood sugar", organId: "pancreas", weight: 3 },
  { match: "hba1c", organId: "pancreas", weight: 3 },
  { match: "glycated hemoglobin", organId: "pancreas", weight: 3 },
  { match: "amylase", organId: "pancreas", weight: 3 },
  { match: "lipase", organId: "pancreas", weight: 3 },
  { match: "insulin", organId: "pancreas", weight: 2 },
  { match: "c-peptide", organId: "pancreas", weight: 2 },
  // Lung / clotting (systemic inflammation markers like CRP/ESR are
  // deliberately unmapped: too nonspecific to illustrate an organ alone)
  { match: "d-dimer", organId: "lung", weight: 2 },
  { match: "abg", organId: "lung", weight: 2 },
  // Blood / systemic (illustrated via circulation)
  { match: "wbc", organId: "heart", weight: 1 },
  { match: "white blood cell", organId: "heart", weight: 1 },
  { match: "platelet", organId: "heart", weight: 1 },
  { match: "plt", organId: "heart", weight: 1 },
  { match: "rbc", organId: "heart", weight: 1 },
  { match: "red blood cell", organId: "heart", weight: 1 },
  { match: "mcv", organId: "heart", weight: 1 },
  { match: "mch", organId: "heart", weight: 1 },
  { match: "hematocrit", organId: "heart", weight: 1 },
  // Bone / systemic (vitamin D is systemic: no single organ to illustrate)
  { match: "calcium", organId: "kidney", weight: 1 },
  { match: "vitamin b12", organId: "stomach", weight: 1 },
  { match: "ferritin", organId: "heart", weight: 1 },
  { match: "iron", organId: "heart", weight: 1 },
];

/**
 * Free-text symptom/condition phrases -> organ. Lower weight than labs.
 * Word-boundary matched to avoid substrings (e.g. "heart" in "hearth").
 */
const KEYWORD_TO_ORGAN: ReadonlyArray<{
  pattern: RegExp;
  organId: OrganId;
  weight: number;
  relatedTo: string;
  subRegion?: string;
}> = [
  // Stomach
  { pattern: /\bgastritis\b/i, organId: "stomach", weight: 3, relatedTo: "stomach-lining health", subRegion: "lining" },
  { pattern: /\bstomach\b/i, organId: "stomach", weight: 2, relatedTo: "stomach health", subRegion: "antrum" },
  { pattern: /\bgastric\b/i, organId: "stomach", weight: 2, relatedTo: "stomach health", subRegion: "antrum" },
  { pattern: /\bulcers?\b/i, organId: "stomach", weight: 2, relatedTo: "stomach-lining health", subRegion: "antrum" },
  { pattern: /h\.?\s?pylori/i, organId: "stomach", weight: 3, relatedTo: "stomach health", subRegion: "antrum" },
  { pattern: /\bacidity\b/i, organId: "stomach", weight: 2, relatedTo: "acidity", subRegion: "lining" },
  { pattern: /\bgerd\b/i, organId: "stomach", weight: 2, relatedTo: "acid reflux", subRegion: "fundus" },
  { pattern: /acid reflux/i, organId: "stomach", weight: 2, relatedTo: "acid reflux", subRegion: "fundus" },
  { pattern: /heartburn/i, organId: "stomach", weight: 2, relatedTo: "acid reflux", subRegion: "fundus" },
  { pattern: /epigastric/i, organId: "stomach", weight: 2, relatedTo: "upper abdominal discomfort", subRegion: "antrum" },
  // Nose / sinus
  { pattern: /\bsinus(?:es)?\b/i, organId: "nose-sinus", weight: 3, relatedTo: "sinus", subRegion: "maxillary-sinus" },
  { pattern: /\bsinusitis\b/i, organId: "nose-sinus", weight: 3, relatedTo: "sinus health", subRegion: "maxillary-sinus" },
  { pattern: /\bnasal\b/i, organId: "nose-sinus", weight: 2, relatedTo: "nasal health", subRegion: "nasal-cavity" },
  { pattern: /nasal cavity/i, organId: "nose-sinus", weight: 2, relatedTo: "nasal health", subRegion: "nasal-cavity" },
  { pattern: /\bsneezing\b/i, organId: "nose-sinus", weight: 1, relatedTo: "sneezing", subRegion: "nasal-cavity" },
  { pattern: /congestion/i, organId: "nose-sinus", weight: 1, relatedTo: "congestion", subRegion: "nasal-cavity" },
  { pattern: /runny nose/i, organId: "nose-sinus", weight: 1, relatedTo: "runny nose", subRegion: "nasal-cavity" },
  // Head / brain
  { pattern: /\bheadaches?\b/i, organId: "brain", weight: 2, relatedTo: "headache", subRegion: "cortex" },
  { pattern: /\bmigraines?\b/i, organId: "brain", weight: 2, relatedTo: "headache health", subRegion: "cortex" },
  { pattern: /\bvertigo\b/i, organId: "brain", weight: 1, relatedTo: "vertigo", subRegion: "cortex" },
  // Kidney
  { pattern: /\bkidneys?\b/i, organId: "kidney", weight: 2, relatedTo: "kidney health", subRegion: "cortex" },
  { pattern: /\brenal\b/i, organId: "kidney", weight: 2, relatedTo: "kidney health", subRegion: "cortex" },
  { pattern: /\bckd\b/i, organId: "kidney", weight: 3, relatedTo: "kidney function", subRegion: "nephron" },
  { pattern: /kidney stone/i, organId: "kidney", weight: 3, relatedTo: "kidney health", subRegion: "pelvis" },
  // Liver
  { pattern: /\bliver\b/i, organId: "liver", weight: 2, relatedTo: "liver health", subRegion: "right-lobe" },
  { pattern: /\bhepatic\b/i, organId: "liver", weight: 2, relatedTo: "liver health", subRegion: "right-lobe" },
  { pattern: /\bjaundice\b/i, organId: "liver", weight: 2, relatedTo: "liver health", subRegion: "right-lobe" },
  { pattern: /fatty liver/i, organId: "liver", weight: 3, relatedTo: "liver health", subRegion: "right-lobe" },
  // Lung
  { pattern: /\blungs?\b/i, organId: "lung", weight: 2, relatedTo: "lung health", subRegion: "lower-lobe" },
  { pattern: /\bpneumonia\b/i, organId: "lung", weight: 3, relatedTo: "lung infection pattern", subRegion: "lower-lobe" },
  { pattern: /\basthma\b/i, organId: "lung", weight: 2, relatedTo: "breathing health", subRegion: "bronchi" },
  { pattern: /\bcough(?:ing)?\b/i, organId: "lung", weight: 1, relatedTo: "cough", subRegion: "bronchi" },
  { pattern: /shortness of breath/i, organId: "lung", weight: 1, relatedTo: "breathlessness", subRegion: "lower-lobe" },
  // Heart
  { pattern: /\bhearts?\b/i, organId: "heart", weight: 2, relatedTo: "heart health", subRegion: "ventricle" },
  { pattern: /\bcardiac\b/i, organId: "heart", weight: 2, relatedTo: "heart health", subRegion: "ventricle" },
  { pattern: /chest pain/i, organId: "heart", weight: 1, relatedTo: "chest discomfort", subRegion: "ventricle" },
  { pattern: /blood pressure/i, organId: "heart", weight: 1, relatedTo: "blood pressure", subRegion: "artery" },
  { pattern: /\banemia\b/i, organId: "heart", weight: 2, relatedTo: "circulation health", subRegion: "circulation" },
  { pattern: /\banaemia\b/i, organId: "heart", weight: 2, relatedTo: "circulation health", subRegion: "circulation" },
  // Thyroid
  { pattern: /\bthyroid\b/i, organId: "thyroid", weight: 2, relatedTo: "thyroid health", subRegion: "lobe" },
  { pattern: /hypothyroid/i, organId: "thyroid", weight: 2, relatedTo: "thyroid function", subRegion: "lobe" },
  { pattern: /hyperthyroid/i, organId: "thyroid", weight: 2, relatedTo: "thyroid function", subRegion: "lobe" },
  // Pancreas / intestine / bladder / spleen
  { pattern: /\bdiabetes\b/i, organId: "pancreas", weight: 2, relatedTo: "blood sugar", subRegion: "islets" },
  { pattern: /\bpancrea/i, organId: "pancreas", weight: 2, relatedTo: "pancreas health", subRegion: "body" },
  { pattern: /\bintestin(?:e|es)\b/i, organId: "intestine", weight: 2, relatedTo: "intestinal health", subRegion: "large-intestine" },
  { pattern: /\bcolon\b/i, organId: "intestine", weight: 2, relatedTo: "colon health", subRegion: "large-intestine" },
  { pattern: /\bcolonoscopy\b/i, organId: "intestine", weight: 2, relatedTo: "colon health", subRegion: "large-intestine" },
  { pattern: /\bbladder\b/i, organId: "bladder", weight: 2, relatedTo: "bladder health", subRegion: "wall" },
  { pattern: /\bspleen\b/i, organId: "spleen", weight: 2, relatedTo: "spleen health", subRegion: "body" },
];

function validOrgan(id: string): id is OrganId {
  return (ORGAN_IDS as ReadonlyArray<string>).includes(id);
}

export type OrganScore = {
  organId: OrganId;
  score: number;
  relatedTo: string | null;
  subRegion: string | null;
  evidence: string[];
};

function tokenizeName(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Short lab tokens (ALT, T3, ESR, ...) must match whole words — substring
 * matching fires inside unrelated names ("ast" in "fasting", "alt" in
 * "cobalt"). Longer distinctive names keep substring matching.
 */
function labMatchWeight(rawName: string, match: string, baseWeight: number): number | null {
  const normalized = match.toLowerCase();
  const matchTokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  if (matchTokens.length === 1 && matchTokens[0].length <= 4) {
    // Plural-tolerant whole-word match: "RBCs" hits "rbc", "TSHs" hits "tsh".
    const tokens = tokenizeName(rawName);
    const token = matchTokens[0];
    const hit = tokens.includes(token) || tokens.includes(`${token}s`) || (token.endsWith("s") && tokens.includes(token.slice(0, -1)));
    return hit ? baseWeight : null;
  }
  return rawName.toLowerCase().includes(normalized) ? baseWeight : null;
}

function evidenceLine(line: string): string {
  return line.length > 200 ? line.slice(0, 200) : line;
}

/**
 * Deterministic organ scoring.
 * - Labs weigh more than prose; `normal` labs contribute nothing.
 * - Each printed test contributes at most once per organ (highest weight),
 *   so repeats and overlapping aliases (FT3/T3) cannot inflate the score.
 * - relatedTo/subRegion travel as the winning pair: only a strictly
 *   stronger trigger replaces them, so labels never mix across triggers.
 * - A lab-only organ needs score >= 3 (a real panel, not one weak number);
 *   keyword-backed organs pass at the confidence floor.
 * Returns at most MAX suggestions, strongest first (raw score breaks ties).
 */
export function suggestOrgans(
  labs: LabSignal[] = [],
  text = "",
): VisualizationSuggestion[] {
  const safeLabs = Array.isArray(labs) ? labs : [];
  const scores = new Map<OrganId, OrganScore & { winWeight: number; hasKeyword: boolean }>();
  const bump = (
    organId: OrganId,
    points: number,
    relatedTo?: string | null,
    subRegion?: string | null,
    evidence?: string,
    fromKeyword = false,
  ) => {
    const current = scores.get(organId) ?? {
      organId,
      score: 0,
      relatedTo: null,
      subRegion: null,
      evidence: [],
      winWeight: -1,
      hasKeyword: false,
    };
    current.score += points;
    if ((relatedTo || subRegion) && points > current.winWeight) {
      current.winWeight = points;
      if (relatedTo) current.relatedTo = relatedTo;
      if (subRegion) current.subRegion = subRegion;
    }
    if (fromKeyword) current.hasKeyword = true;
    if (evidence && !current.evidence.includes(evidence) && current.evidence.length < 6) {
      current.evidence.push(evidence);
    }
    scores.set(organId, current);
  };

  const contributedTests = new Set<string>();
  for (const lab of safeLabs) {
    if (!lab) continue;
    const canonical = (lab.canonicalName ?? "").trim();
    const printed = (lab.test ?? "").trim();
    // Prefer the canonical name; append the printed name only when it adds
    // information instead of repeating it ("Creatinine, Serum / Creatinine").
    const lowerCanonical = canonical.toLowerCase();
    const lowerPrinted = printed.toLowerCase();
    const displayName =
      canonical && printed && lowerCanonical !== lowerPrinted &&
      !lowerCanonical.includes(lowerPrinted) && !lowerPrinted.includes(lowerCanonical)
        ? `${canonical} / ${printed}`
        : canonical || printed;
    const rawName = `${canonical} ${printed}`.trim();
    if (!rawName) continue;
    // A normal result is evidence of health, not of an organ to illustrate.
    if (lab.flag === "normal") continue;
    const abnormal = lab.flag === "high" || lab.flag === "low";
    const normName = rawName.toLowerCase().replace(/\s+/g, " ");
    const best = new Map<OrganId, number>();
    for (const entry of LAB_TO_ORGAN) {
      if (!validOrgan(entry.organId)) continue;
      const weight = labMatchWeight(rawName, entry.match, entry.weight);
      if (weight !== null) best.set(entry.organId, Math.max(best.get(entry.organId) ?? 0, weight));
    }
    for (const [organId, weight] of best) {
      const contributionKey = `${organId}::${normName}`;
      if (contributedTests.has(contributionKey)) continue;
      contributedTests.add(contributionKey);
      bump(
        organId,
        weight + (abnormal ? 1 : 0),
        null,
        null,
        evidenceLine(`Lab: ${displayName}${abnormal ? ` (${lab.flag})` : ""}`),
      );
    }
  }

  const haystack = text ?? "";
  for (const entry of KEYWORD_TO_ORGAN) {
    if (!validOrgan(entry.organId)) continue;
    entry.pattern.lastIndex = 0;
    const match = entry.pattern.exec(haystack);
    if (match) {
      bump(entry.organId, entry.weight, entry.relatedTo, entry.subRegion ?? null, `Text: "${match[0].trim()}"`, true);
    }
  }

  return [...scores.values()]
    .map((score) => ({
      organId: score.organId,
      subRegion: score.subRegion,
      relatedTo: score.relatedTo,
      // 4 points saturate to 1.0; lab-only organs need 3+ (a real panel).
      confidence: Math.min(1, Math.round((score.score / 4) * 100) / 100),
      evidence: score.evidence,
      laterality: "unknown" as const,
      rawScore: score.score,
      keywordBacked: score.hasKeyword,
    }))
    .filter((s) => s.confidence >= MIN_VISUALIZATION_CONFIDENCE && (s.keywordBacked || s.rawScore >= 3))
    .sort((a, b) => b.confidence - a.confidence || b.rawScore - a.rawScore)
    .slice(0, MAX_VISUALIZATIONS_PER_REPORT)
    .map((s) => ({
      organId: s.organId,
      subRegion: s.subRegion,
      relatedTo: s.relatedTo,
      confidence: s.confidence,
      evidence: s.evidence,
      laterality: s.laterality,
    }));
}
