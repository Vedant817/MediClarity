# 3D Model Attribution

Educational organ visualizations in MediClarity use free-licensed 3D models.
No model depicts any individual patient; all views are illustrative.

## Human Reference Atlas 3D Reference Object Library — CC-BY 4.0

Heart, lung, kidney, liver, large intestine, pancreas, brain, urinary
bladder, and spleen meshes come from the Human Reference Atlas (HRA) 3D
Reference Object Library, served from the HRA CDN and mirrored locally in
`public/models/` as an offline fallback.

- Source: https://humanatlas.io/3d-reference-library
- Per-organ files resolved via the HRA reference-organs API
  (`https://apps.humanatlas.io/api/v1/reference-organs`)
- License: Creative Commons Attribution 4.0 International (CC-BY 4.0)
- Required credit (shown in-app wherever a model is displayed):
  "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)"

## NIH 3D — Stomach (pending direct download)

- Candidate: NIH 3D entry 3DPX-021124, "Stomach (ventriculus)" by Johnson J
- Page: https://3d.nih.gov/entries/3DPX-021124
- License: CC-BY 4.0
- Status: direct file download is gated by NIH 3D interaction; the viewer
  shows an educational placeholder card for the stomach until a direct
  file is vendored. Re-run `node scripts/fetch-anatomy-models.mjs` after
  vendoring to flip the manifest entry to `local`.

## Not yet sourced (placeholder card in viewer)

- Nose & sinuses, thyroid: no verified free mesh yet. The viewer shows an
  educational placeholder card with the same captions, pins-as-list, and
  disclaimer — never a wrong-organ mesh.

## License rules for contributors

- Never ship Sketchfab or other non-commercial (NC) models.
- Every registry entry in `src/lib/anatomy/registry.ts` must carry
  `license` + `attribution`; `node scripts/fetch-anatomy-models.mjs`
  must report the organ as `local` before the viewer offers 3D for it.
