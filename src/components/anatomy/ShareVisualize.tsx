"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrganModel } from "@/lib/anatomy/registry";
import { ORGAN_DISPLAY_NAMES } from "@/lib/anatomy/types";
import type { VisualizationSuggestion } from "@/lib/anatomy/types";

const OrganCompare = dynamic(() => import("@/components/anatomy/OrganCompare"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-4 h-72 w-full" />
    </div>
  ),
});

/**
 * Public 3D section for shared report links. Rendered only when the share
 * carries visualizations; otherwise the page stays exactly as before.
 */
export default function ShareVisualize({
  visualizations,
  caption,
}: {
  visualizations: VisualizationSuggestion[];
  caption: string;
}) {
  if (visualizations.length === 0) return null;
  return (
    <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3 font-mono text-xs uppercase tracking-wider text-slate-500">
        3D explanation
      </div>
      <div className="space-y-8 p-5">
        {visualizations.map((suggestion) => (
          <OrganCompare
            key={`${suggestion.organId}-${suggestion.subRegion ?? "whole"}`}
            entry={getOrganModel(suggestion.organId)}
            suggestion={suggestion}
            caption={caption}
          />
        ))}
        <p className="text-xs text-slate-500">
          Areas: {visualizations.map((s) => ORGAN_DISPLAY_NAMES[s.organId]).join(" · ")}. Tap
          and drag to rotate; scroll to zoom.
        </p>
      </div>
    </section>
  );
}
