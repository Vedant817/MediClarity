// Fetch + verify free-licensed organ GLBs into public/models.
// - HRA CDN files: CC-BY 4.0, direct links discovered via the HRA reference-organs API.
// - Stomach: NIH 3D entry 3DPX-021124 (CC-BY), direct S3 input file.
// Verifies GLB magic bytes before writing; writes public/models/manifest.json.
// Models are illustrative reference geometry only, not patient-specific;
// the viewer must always show the educational disclaimer with them.
// Local files may be meshopt-optimized (smaller than CDN originals): re-runs
// KEEP local bytes after a magic check; pass --force to re-fetch raw CDN bytes.
// Usage: node scripts/fetch-anatomy-models.mjs [--force]
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "models");

const HRA = "https://cdn.humanatlas.io/digital-objects/ref-organ";

/** organId -> {url, license, attribution} — keep in sync with src/lib/anatomy/registry.ts */
const SOURCES = {
  heart: { url: `${HRA}/heart-female/v1.3/assets/3d-vh-f-heart.glb`, license: "CC-BY 4.0", attribution: "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)" },
  lung: { url: `${HRA}/lung-female/v1.4/assets/3d-vh-f-lung.glb`, license: "CC-BY 4.0", attribution: "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)" },
  kidney: { url: `${HRA}/kidney-female-left/v1.3/assets/3d-vh-f-kidney-l.glb`, license: "CC-BY 4.0", attribution: "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)" },
  liver: { url: `${HRA}/liver-female/v1.2/assets/3d-vh-f-liver.glb`, license: "CC-BY 4.0", attribution: "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)" },
  intestine: { url: `${HRA}/large-intestine-female/v1.3/assets/3d-sbu-f-large-intestine.glb`, license: "CC-BY 4.0", attribution: "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)" },
  pancreas: { url: `${HRA}/pancreas-female/v1.3/assets/3d-vh-f-pancreas.glb`, license: "CC-BY 4.0", attribution: "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)" },
  brain: { url: `${HRA}/brain-female/v1.4/assets/3d-allen-f-brain.glb`, license: "CC-BY 4.0", attribution: "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)" },
  bladder: { url: `${HRA}/urinary-bladder-female/v1.2/assets/3d-vh-f-urinary-bladder.glb`, license: "CC-BY 4.0", attribution: "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)" },
  spleen: { url: `${HRA}/spleen-female/v1.3/assets/3d-vh-f-spleen.glb`, license: "CC-BY 4.0", attribution: "Human Reference Atlas 3D Reference Object Library (CC-BY 4.0)" },
  stomach: { url: "https://persist-3d-media.s3.amazonaws.com/660113/realistic_stomach.glb", license: "CC-BY 4.0", attribution: "NIH 3D entry 3DPX-021124, Stomach (ventriculus) by Johnson J (CC-BY 4.0)" },
  // nose-sinus + thyroid: no verified free mesh yet — viewer shows an
  // educational placeholder card until Task 3 follow-up lands an asset.
};

function isGlb(buffer) {
  // Binary GLB magic is the ASCII string "glTF" (0x67 0x6C 0x54 0x46).
  return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "glTF";
}

const force = process.argv.includes("--force");
mkdirSync(outDir, { recursive: true });
const manifest = {};
let failedRequired = 0;

for (const [organId, source] of Object.entries(SOURCES)) {
  const file = `${organId}.glb`;
  const dest = join(outDir, file);
  try {
    if (!force && existsSync(dest)) {
      const bytes = statSync(dest).size;
      const head = readFileSync(dest).subarray(0, 12);
      if (!isGlb(head)) throw new Error("existing file failed GLB magic check");
      manifest[organId] = { file, bytes, url: source.url, license: source.license, attribution: source.attribution, status: "local", verifiedAt: new Date().toISOString() };
      console.log(`KEEP ${organId} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
      continue;
    }
    const response = await fetch(source.url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!isGlb(buffer)) throw new Error(`bad magic: ${JSON.stringify(buffer.subarray(0, 4).toString())}`);
    writeFileSync(dest, buffer);
    manifest[organId] = { file, bytes: buffer.length, url: source.url, license: source.license, attribution: source.attribution, status: "local", verifiedAt: new Date().toISOString() };
    console.log(`OK ${organId} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    // Stomach is a documented gap (NIH 3D gates direct download; the viewer
    // shows an educational placeholder). Every other failure is blocking.
    if (organId !== "stomach") failedRequired += 1;
    manifest[organId] = { file, url: source.url, license: source.license, attribution: source.attribution, status: organId === "stomach" ? "gap" : "failed", error: String((error && error.message) || error).slice(0, 160) };
    console.log(`FAIL ${organId}: ${error.message}`);
  }
}

manifest["nose-sinus"] = { file: null, url: null, license: "pending", attribution: "pending", status: "placeholder", note: "No verified free mesh yet; viewer shows an educational placeholder card." };
manifest["thyroid"] = { file: null, url: null, license: "pending", status: "placeholder", attribution: "pending", note: "No verified free mesh yet; viewer shows an educational placeholder card." };

writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(failedRequired === 0 ? "All required assets verified." : `${failedRequired} required asset(s) FAILED.`);
process.exit(failedRequired === 0 ? 0 : 1);
