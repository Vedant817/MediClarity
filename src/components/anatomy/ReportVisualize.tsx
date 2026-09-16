"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Markdown from "@/components/Markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { toPlainExcerpt } from "@/lib/summary-excerpt";
import { getOrganModel } from "@/lib/anatomy/registry";
import { ORGAN_DISPLAY_NAMES, ORGAN_IDS, VISUALIZATION_COPY, type OrganId, type VisualizationSuggestion } from "@/lib/anatomy/types";

const OrganCompare = dynamic(() => import("@/components/anatomy/OrganCompare"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-4 h-72 w-full" />
    </div>
  ),
});

type VisualizeResponse = {
  visualizations: VisualizationSuggestion[];
  cached?: boolean;
  disclaimer?: string;
  error?: string;
  upgradeUrl?: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; upgradeUrl?: string }
  | { status: "ready"; visualizations: VisualizationSuggestion[] };

/**
 * Lazy 3D Explain tab content. Mounts (and fetches) only when the user
 * opens the tab, so reports that never need visualization cost nothing.
 */
export type VisualizeLab = {
  canonicalName?: string;
  test: string;
  value: number;
  unit?: string;
  refMin?: number;
  refMax?: number;
  flag: "normal" | "high" | "low" | "unknown";
};

/**
 * Lazy 3D Explain tab content. Mounts (and fetches) only when the user
 * opens the tab, so reports that never need visualization cost nothing.
 */
export default function ReportVisualize({ reportId, summary, labs = [] }: { reportId: string; summary: string; labs?: VisualizeLab[] }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [manualOrgan, setManualOrgan] = useState<OrganId | "">("");
  const [detail, setDetail] = useState<"simple" | "detailed">("simple");

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch("/api/visualize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId }),
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as VisualizeResponse;
        if (cancelled) return;
        if (!response.ok) {
          setState({ status: "error", message: data.error || "3D explanation could not be loaded", upgradeUrl: data.upgradeUrl });
          return;
        }
        setState({ status: "ready", visualizations: data.visualizations ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "3D explanation could not be loaded" });
      });
    return () => {
      cancelled = true;
    };
  }, [reportId, attempt]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading 3D explanation">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <p className="text-sm text-amber-950">{state.message}</p>
        {state.upgradeUrl ? (
          <a
            href={state.upgradeUrl}
            className="mt-4 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            View plans
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (state.visualizations.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold">No specific organ detected</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This report reads like general lab work with no single area standing out, so there is
          nothing specific to illustrate. Your summary, labs, and trends above still apply.
        </p>
        <p className="mt-3 text-xs font-semibold text-slate-700">{VISUALIZATION_COPY.disclaimer}</p>
      </div>
    );
  }

  const caption = toPlainExcerpt(summary, 320) || "Key findings from this report, explained in simple language.";
  const abnormalLabs = labs.filter((lab) => lab.flag === "high" || lab.flag === "low");
  const manualSuggestion: VisualizationSuggestion | null = manualOrgan
    ? { organId: manualOrgan, subRegion: null, relatedTo: null, confidence: 0, evidence: [], laterality: "unknown" }
    : null;
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-1" role="group" aria-label="Explanation detail level">
        {(["simple", "detailed"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDetail(option)}
            aria-pressed={detail === option}
            className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold capitalize ${
              detail === option
                ? "bg-teal-700 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option === "simple" ? "Simple view" : "Detailed view"}
          </button>
        ))}
      </div>
      {detail === "detailed" && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm leading-7 text-slate-700">
            <Markdown>{summary}</Markdown>
          </div>
          {abnormalLabs.length > 0 ? (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Abnormal results ({abnormalLabs.length})
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {abnormalLabs.map((lab, index) => (
                  <li key={`${lab.canonicalName || lab.test}-${index}`} className="flex items-center justify-between gap-2">
                    <span className="font-medium">{lab.canonicalName || lab.test}</span>
                    <span className="font-mono text-xs text-slate-600">
                      {lab.value} {lab.unit ?? ""} · {lab.refMin ?? "—"}–{lab.refMax ?? "—"} ·{" "}
                      <strong className={lab.flag === "high" ? "text-rose-700" : "text-amber-700"}>{lab.flag}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No abnormal results in this report.</p>
          )}
        </div>
      )}
      {state.visualizations.map((suggestion) => (
        <OrganCompare
          key={`${suggestion.organId}-${suggestion.subRegion ?? "whole"}`}
          entry={getOrganModel(suggestion.organId)}
          suggestion={suggestion}
          caption={caption}
          allowTranslate
          labs={abnormalLabs.map((lab) => ({
            test: lab.canonicalName || lab.test,
            value: lab.value,
            unit: lab.unit,
            flag: lab.flag,
          }))}
        />
      ))}
      {manualSuggestion && (
        <OrganCompare
          key={`manual-${manualSuggestion.organId}`}
          entry={getOrganModel(manualSuggestion.organId)}
          suggestion={manualSuggestion}
          caption={caption}
          manual
          allowTranslate
        />
      )}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <label className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
          <span className="font-semibold">Not the right area?</span>
          <select
            aria-label="Choose an organ to explore"
            value={manualOrgan}
            onChange={(event) => setManualOrgan(event.target.value as OrganId | "")}
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-600"
          >
            <option value="">Choose an organ to explore…</option>
            {ORGAN_IDS.map((organId) => (
              <option key={organId} value={organId}>
                {ORGAN_DISPLAY_NAMES[organId]}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Exploring an organ yourself is for learning only — it says nothing about your report.
        </p>
      </div>
      <p className="text-xs text-slate-500">
        Areas: {state.visualizations.map((s) => ORGAN_DISPLAY_NAMES[s.organId]).join(" · ") || "none detected"}. Tap
        and drag to rotate; scroll to zoom.
      </p>
    </div>
  );
}
