import test from "node:test";
import assert from "node:assert/strict";
import { getOrganModel } from "../src/lib/anatomy/registry.ts";
import { resolveHotspot, shouldRenderMesh } from "../src/lib/anatomy/viewer.ts";

test("renders mesh only for verified organs", () => {
  assert.equal(shouldRenderMesh(getOrganModel("kidney")), true);
  assert.equal(shouldRenderMesh(getOrganModel("stomach")), false);
  assert.equal(shouldRenderMesh(getOrganModel("nose-sinus")), false);
  assert.equal(shouldRenderMesh(getOrganModel("thyroid")), false);
});

test("resolves the exact subRegion hotspot", () => {
  const pin = resolveHotspot(getOrganModel("kidney"), "pelvis");
  assert.equal(pin.key, "pelvis");
  assert.equal(pin.label, "Renal pelvis");
  assert.equal(pin.position.length, 3);
});

test("falls back to the first hotspot for unknown regions", () => {
  const pin = resolveHotspot(getOrganModel("liver"), "no-such-region");
  assert.equal(pin.key, "right-lobe");
  const empty = resolveHotspot(getOrganModel("liver"), null);
  assert.equal(empty.key, "right-lobe");
});
