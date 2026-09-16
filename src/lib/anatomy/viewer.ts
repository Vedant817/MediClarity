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
 * Uniform scale so a model of `size` fills `fill` (0-1) of the visible
 * viewport, fitting the tighter axis. Wide flat organs (pancreas) then
 * fill the width; tall ones (kidney) fill the height — no fixed
 * one-size scale that leaves oceans of empty canvas. Falls back to 1
 * when measurements are missing so the model never vanishes.
 */
export function fitModelScale(
  size: { x: number; y: number },
  viewport: { width: number; height: number },
  fill = 0.85,
): number {
  if (
    !Number.isFinite(size.x) ||
    !Number.isFinite(size.y) ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    size.x <= 0 ||
    size.y <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return 1;
  }
  const clampedFill = Math.min(Math.max(fill, 0.1), 1);
  return Math.min((viewport.width * clampedFill) / size.x, (viewport.height * clampedFill) / size.y);
}
