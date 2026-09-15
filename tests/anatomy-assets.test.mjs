import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL_REGISTRY, registeredOrganIds } from "../src/lib/anatomy/registry.ts";
import { ORGAN_IDS } from "../src/lib/anatomy/types.ts";

const MODELS_DIR = join(process.cwd(), "public", "models");

function loadManifest() {
  const raw = readFileSync(join(MODELS_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw);
}

test("manifest covers the full taxonomy", () => {
  const manifest = loadManifest();
  assert.deepEqual(Object.keys(manifest).sort(), [...ORGAN_IDS].sort());
});

test("verified organs have real local GLB files", () => {
  const manifest = loadManifest();
  for (const organId of registeredOrganIds()) {
    const row = manifest[organId];
    assert.ok(row, `${organId} missing from manifest`);
    if (row.status !== "local") continue;
    const bytes = readFileSync(join(MODELS_DIR, row.file));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF", `${organId} bad magic`);
    assert.ok(bytes.length > 10_000, `${organId} suspiciously small`);
    assert.equal(row.license, MODEL_REGISTRY[organId].license);
  }
});

test("registry CDN urls match the manifest source urls", () => {
  const manifest = loadManifest();
  for (const organId of registeredOrganIds()) {
    const row = manifest[organId];
    if (row.status !== "local") continue;
    assert.equal(MODEL_REGISTRY[organId].glb, row.url, `${organId} registry/manifest drift`);
    assert.equal(MODEL_REGISTRY[organId].fallbackGlb, `/models/${row.file}`, `${organId} fallback drift`);
  }
});

test("registry mesh status mirrors the manifest", () => {
  const manifest = loadManifest();
  for (const organId of registeredOrganIds()) {
    const row = manifest[organId];
    const entry = MODEL_REGISTRY[organId];
    if (row.status === "local") {
      assert.equal(entry.meshStatus, "local", `${organId} meshStatus drift`);
    } else {
      assert.equal(entry.meshStatus, "pending", `${organId} meshStatus drift`);
    }
  }
});

test("placeholder organs are explicitly marked, never silently missing", () => {
  const manifest = loadManifest();
  for (const [organId, row] of Object.entries(manifest)) {
    assert.ok(
      ["local", "gap", "placeholder"].includes(row.status),
      `${organId} has unknown status ${row.status}`,
    );
    if (row.status !== "local") {
      // Check the registry-advertised file, not just <organId>.glb.
      const fallback = MODEL_REGISTRY[organId]?.fallbackGlb;
      if (fallback) {
        assert.ok(
          !existsSync(join(MODELS_DIR, fallback.replace("/models/", ""))),
          `${organId} unexpectedly present at ${fallback}`,
        );
      }
    }
  }
  for (const absent of ["stomach.glb", "thyroid.glb", "nose-sinus.glb", "nasal-cavity.glb"]) {
    assert.ok(!existsSync(join(MODELS_DIR, absent)), `${absent} unexpectedly present`);
  }
});
