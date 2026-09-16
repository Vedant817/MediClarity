import type { OrganHotspot, OrganModelEntry } from "./types.ts";

export type ResolvedHotspot = {
  key: string;
  label: string;
  position: [number, number, number];
};

/** True only when a verified mesh is vendored — otherwise show the placeholder card. */
export function shouldRenderMesh(entry: OrganModelEntry): boolean {
  return entry.meshStatus === "local";
}

/**
 * Resolve the pin for a suggestion: exact subRegion match, else the first
 * registered hotspot (documented as approximate), never a crash on unknown.
 */
export function resolveHotspot(entry: OrganModelEntry, subRegion: string | null): ResolvedHotspot {
  if (subRegion && entry.hotspots[subRegion]) {
    return { key: subRegion, ...entry.hotspots[subRegion] };
  }
  const [key, hotspot] = Object.entries(entry.hotspots)[0] as [string, OrganHotspot];
  return { key, ...hotspot };
}

/**
 * Fit every organ into a stable world-space box. This deliberately does not
 * depend on the mutable R3F viewport: dialog scrolling and control resets
 * must never resize a loaded model. The box fits the fixed default camera on
 * desktop and narrow/mobile panels while preserving useful scale for flat
 * organs such as the pancreas.
 */
export function stableModelScale(size: { x: number; y: number; z: number }): number {
  if (
    !Number.isFinite(size.x) ||
    !Number.isFinite(size.y) ||
    !Number.isFinite(size.z) ||
    size.x <= 0 ||
    size.y <= 0 ||
    size.z <= 0
  ) {
    return 1;
  }
  return Math.min(3 / size.x, 1.75 / size.y, 1.75 / size.z);
}
