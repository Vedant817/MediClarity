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
