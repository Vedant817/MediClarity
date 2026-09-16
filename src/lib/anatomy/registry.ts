import type { OrganId, OrganModelEntry } from "./types.ts";

/**
 * Free-licensed 3D model registry.
 *
 * VERIFIED (meshStatus "local"): 9 organs from the Human Reference Atlas
 * 3D Reference Object Library (CC-BY 4.0), served from the HRA CDN with a
 * meshopt-optimized mirror in public/models (see scripts/fetch-anatomy-models.mjs).
 * PENDING (meshStatus "pending"): stomach (NIH 3D 3DPX-021124, CC-BY, direct
 * download gated — placeholder until vendored), nose-sinus + thyroid (no
 * verified free mesh yet — placeholder, never a wrong-organ mesh).
 *
 * meshStatus MUST mirror public/models/manifest.json (local <-> local,
 * gap/placeholder <-> pending). The viewer offers 3D only for "local".
 * Hotspot positions are snapped to the mesh front surface by
 * scripts/tune-anatomy-hotspots.mjs (raycast from +z); the viewer renders
 * the pin inside the normalized model group so it tracks the mesh.
 */
const HRA = "https://cdn.humanatlas.io/digital-objects/ref-organ";
const LOCAL = "/models";

function hra(path: string): string {
  return `${HRA}/${path}`;
}

function entry(
  organId: OrganId,
  glb: string,
  localFile: string,
  license: string,
  attribution: string,
  hotspots: OrganModelEntry["hotspots"],
  conditions: string[],
  camera?: OrganModelEntry["camera"],
  meshStatus: OrganModelEntry["meshStatus"] = "local",
): OrganModelEntry {
  return {
    organId,
    glb,
    fallbackGlb: `${LOCAL}/${localFile}`,
    license,
    attribution,
    meshStatus,
    camera: camera ?? { position: [0, 0.4, 3.2], fov: 42 },
    hotspots,
    conditions,
  };
}

const HRA_LICENSE = "CC-BY 4.0";
const HRA_ATTRIBUTION = "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)";
const NIH_ATTRIBUTION = "NIH 3D entry 3DPX-021124, Stomach (ventriculus) by Johnson J (CC-BY 4.0)";
const PENDING_ATTRIBUTION = "pending";

export const MODEL_REGISTRY: Record<OrganId, OrganModelEntry> = {
  heart: entry(
    "heart",
    hra("heart-female/v1.3/assets/3d-vh-f-heart.glb"),
    "heart.glb",
    HRA_LICENSE,
    HRA_ATTRIBUTION,
    {
      ventricle: { label: "Ventricle", position: [0.02, 0.41, 0.0] },
      artery: { label: "Artery", position: [0.05, 0.49, 0.01] },
      circulation: { label: "Circulation", position: [0.04, 0.46, 0.01] },
    },
    ["heart health", "blood pressure", "circulation health"],
  ),
  lung: entry(
    "lung",
    hra("lung-female/v1.4/assets/3d-vh-f-lung.glb"),
    "lung.glb",
    HRA_LICENSE,
    HRA_ATTRIBUTION,
    {
      "lower-lobe": { label: "Lower lobe", position: [-0.07, 0.4, 0.01] },
      bronchi: { label: "Bronchi", position: [-0.01, 0.53, 0.01] },
    },
    ["lung health", "lung infection pattern", "breathing health", "cough"],
  ),
  kidney: entry(
    "kidney",
    hra("kidney-female-left/v1.3/assets/3d-vh-f-kidney-l.glb"),
    "kidney.glb",
    HRA_LICENSE,
    HRA_ATTRIBUTION,
    {
      cortex: { label: "Cortex", position: [0.08, 0.28, -0.08] },
      nephron: { label: "Nephron region", position: [0.08, 0.24, -0.05] },
      pelvis: { label: "Renal pelvis", position: [0.08, 0.19, -0.05] },
    },
    ["kidney health", "kidney function"],
  ),
  liver: entry(
    "liver",
    hra("liver-female/v1.2/assets/3d-vh-f-liver.glb"),
    "liver.glb",
    HRA_LICENSE,
    HRA_ATTRIBUTION,
    {
      "right-lobe": { label: "Right lobe", position: [0.06, 0.35, 0.0] },
    },
    ["liver health"],
  ),
  stomach: entry(
    "stomach",
    "https://persist-3d-media.s3.amazonaws.com/660113/realistic_stomach.glb",
    "stomach.glb",
    "CC-BY 4.0",
    NIH_ATTRIBUTION,
    {
      antrum: { label: "Antrum", position: [0.3, -0.4, 0.2] },
      lining: { label: "Lining", position: [0, 0, 0.4] },
      fundus: { label: "Fundus", position: [-0.3, 0.4, 0] },
    },
    ["stomach-lining health", "acid reflux", "stomach health"],
    undefined,
    "pending",
  ),
  intestine: entry(
    "intestine",
    hra("large-intestine-female/v1.3/assets/3d-sbu-f-large-intestine.glb"),
    "intestine.glb",
    HRA_LICENSE,
    HRA_ATTRIBUTION,
    // NOTE: mesh covers the large intestine only; small-bowel illustration
    // needs a dedicated asset (tracked for a later task).
    {
      "large-intestine": { label: "Large intestine", position: [0.07, 0.13, 0.06] },
    },
    ["intestinal health", "colon health"],
  ),
  pancreas: entry(
    "pancreas",
    hra("pancreas-female/v1.3/assets/3d-vh-f-pancreas.glb"),
    "pancreas.glb",
    HRA_LICENSE,
    HRA_ATTRIBUTION,
    {
      body: { label: "Body", position: [0.03, 0.27, -0.02] },
      islets: { label: "Islet region", position: [-0.02, 0.27, -0.03] },
    },
    ["blood sugar", "pancreas health"],
  ),
  brain: entry(
    "brain",
    hra("brain-female/v1.4/assets/3d-allen-f-brain.glb"),
    "brain.glb",
    HRA_LICENSE,
    HRA_ATTRIBUTION,
    {
      cortex: { label: "Cortex", position: [-0.01, 0.83, 0.02] },
    },
    ["headache health", "vertigo"],
  ),
  thyroid: entry(
    "thyroid",
    `${LOCAL}/thyroid.glb`,
    "thyroid.glb",
    "pending",
    PENDING_ATTRIBUTION,
    {
      lobe: { label: "Lobe", position: [0.2, 0, 0.3] },
    },
    ["thyroid health", "thyroid function"],
    undefined,
    "pending",
  ),
  "nose-sinus": entry(
    "nose-sinus",
    `${LOCAL}/nose-sinus.glb`,
    "nose-sinus.glb",
    "pending",
    PENDING_ATTRIBUTION,
    {
      "nasal-cavity": { label: "Nasal cavity", position: [0, 0, 0.3] },
      "maxillary-sinus": { label: "Maxillary sinus", position: [0.3, -0.1, 0.2] },
    },
    ["sinus health", "nasal health", "congestion"],
    undefined,
    "pending",
  ),
  bladder: entry(
    "bladder",
    hra("urinary-bladder-female/v1.2/assets/3d-vh-f-urinary-bladder.glb"),
    "bladder.glb",
    HRA_LICENSE,
    HRA_ATTRIBUTION,
    {
      wall: { label: "Wall", position: [-0.02, 0.0, 0.0] },
    },
    ["bladder health"],
  ),
  spleen: entry(
    "spleen",
    hra("spleen-female/v1.3/assets/3d-vh-f-spleen.glb"),
    "spleen.glb",
    HRA_LICENSE,
    HRA_ATTRIBUTION,
    {
      body: { label: "Body", position: [0.08, 0.34, -0.09] },
    },
    ["spleen health"],
  ),
};

export function getOrganModel(organId: OrganId): OrganModelEntry {
  return MODEL_REGISTRY[organId];
}

/** Every organ the intelligence layer is allowed to suggest. */
export function registeredOrganIds(): OrganId[] {
  return Object.keys(MODEL_REGISTRY) as OrganId[];
}
