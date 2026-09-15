import { z } from "zod";

/**
 * Closed organ taxonomy for educational 3D visualization.
 * The intelligence layer may ONLY output these ids — never free text —
 * so an ambiguous report degrades to `unknown` instead of a hallucinated
 * organ. Display names use "often discussed with" framing; nothing here
 * is a diagnosis.
 */
export const ORGAN_IDS = [
  "heart",
  "lung",
  "kidney",
  "liver",
  "stomach",
  "intestine",
  "pancreas",
  "brain",
  "thyroid",
  "nose-sinus",
  "bladder",
  "spleen",
] as const;

export type OrganId = (typeof ORGAN_IDS)[number];

export const ORGAN_DISPLAY_NAMES: Record<OrganId, string> = {
  heart: "Heart & circulation",
  lung: "Lungs",
  kidney: "Kidneys",
  liver: "Liver",
  stomach: "Stomach",
  intestine: "Intestines",
  pancreas: "Pancreas",
  brain: "Brain & head",
  thyroid: "Thyroid",
  "nose-sinus": "Nose & sinuses",
  bladder: "Bladder",
  spleen: "Spleen",
};

export type OrganHotspot = {
  /** Human label for the pin, e.g. "Antrum". */
  label: string;
  /** Position in the model's local units. Approximate unless tuned. */
  position: [number, number, number];
};

export type OrganModelEntry = {
  organId: OrganId;
  /** Primary GLB URL (HRA CDN or local /models/*.glb). */
  glb: string;
  /** Local fallback served from public/models when the CDN is unreachable. */
  fallbackGlb: string;
  license: string;
  attribution: string;
  /**
   * "local" only when a verified mesh is vendored in public/models AND the
   * manifest reports status local. Anything else renders the educational
   * placeholder card — never a wrong-organ mesh. Must mirror manifest.json.
   */
  meshStatus: "local" | "pending";
  /** Approximate camera framing for this organ. */
  camera: { position: [number, number, number]; fov: number };
  /** subRegion key -> hotspot pin. */
  hotspots: Record<string, OrganHotspot>;
  /** Condition labels this organ may illustrate (educational only). */
  conditions: string[];
};

export const visualizationSuggestionSchema = z.object({
  organId: z.enum(ORGAN_IDS),
  subRegion: z.string().trim().min(1).max(80).nullable().optional(),
  /** Educational topic label, e.g. "gastritis". Never a diagnosis. */
  relatedTo: z.string().trim().min(1).max(120).nullable().optional(),
  confidence: z.number().min(0).max(1),
  /** Short quoted spans from the report that triggered this suggestion. */
  evidence: z.array(z.string().trim().min(1).max(200)).max(6),
  laterality: z.enum(["left", "right", "central", "unknown"]).default("unknown"),
});

export type VisualizationSuggestion = z.infer<typeof visualizationSuggestionSchema>;

/** Suggestions below this confidence are hidden; show the neutral placeholder. */
export const MIN_VISUALIZATION_CONFIDENCE = 0.5;
/** Never illustrate more organs than this per report. */
export const MAX_VISUALIZATIONS_PER_REPORT = 3;

/**
 * Mandatory framing copy for any UI that renders relatedTo/conditions.
 * Topic labels (e.g. "stomach-lining health") must always appear as
 * "Often discussed with: X" plus the disclaimer — never as a conclusion.
 */
export const VISUALIZATION_COPY = {
  relatedPrefix: "Often discussed with",
  disclaimer: "Educational illustration only — not a diagnosis.",
} as const;
