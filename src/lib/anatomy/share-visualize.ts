import { suggestOrgans, type LabSignal } from "./organ-keywords.ts";
import { visualizationSuggestionSchema, type VisualizationSuggestion } from "./types.ts";

export type PublicReportLike = {
  summary?: string | null;
  visualizations?: Array<{
    organId: string;
    subRegion?: string | null;
    relatedTo?: string | null;
    confidence: number;
    evidence: string[];
    laterality?: string;
  }> | null;
};

/**
 * Visualizations for the PUBLIC share page. Uses the owner's cached
 * suggestions when present, otherwise runs the deterministic map over the
 * shared labs + summary. Never calls the LLM: the anonymous endpoint must
 * not spend model budget or accept prompt-influencing input beyond what the
 * owner already shared. Returns [] when nothing clears the floor.
 */
export function resolvePublicVisualizations(
  report: PublicReportLike,
  labs: LabSignal[],
): VisualizationSuggestion[] {
  const cached = Array.isArray(report?.visualizations) ? report.visualizations : [];
  if (cached.length > 0) {
    const out: VisualizationSuggestion[] = [];
    for (const item of cached) {
      const parsed = visualizationSuggestionSchema.safeParse({ ...item, laterality: item.laterality ?? "unknown" });
      if (parsed.success) out.push(parsed.data);
      if (out.length >= 3) break;
    }
    if (out.length > 0) return out;
  }
  return suggestOrgans(labs, report?.summary ?? "");
}
