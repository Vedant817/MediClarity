"use client";

import { TriangleAlert } from "lucide-react";
import { EMERGENCY_LINE, ORGAN_RED_FLAGS } from "@/lib/anatomy/red-flags";
import type { OrganId } from "@/lib/anatomy/types";

/**
 * Generic urgent-care pointers shown under every 3D explanation.
 * Static curated content — never generated, never about this report —
 * so it cannot hallucinate a finding onto the patient.
 */
export default function OrganRedFlags({ organId }: { organId: OrganId }) {
  const flags = ORGAN_RED_FLAGS[organId] ?? [];
  if (flags.length === 0) return null;
  return (
    <section
      aria-label="When to seek prompt care"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        When to seek prompt care
      </h4>
      <ul className="mt-2 space-y-1 text-sm text-amber-950">
        {flags.map((flag) => (
          <li key={flag} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
            {flag}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-900">{EMERGENCY_LINE}</p>
    </section>
  );
}
