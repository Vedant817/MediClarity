import test from "node:test";
import assert from "node:assert/strict";
import { EMERGENCY_LINE, ORGAN_RED_FLAGS } from "../src/lib/anatomy/red-flags.ts";
import { ORGAN_IDS } from "../src/lib/anatomy/types.ts";

const BANNED = [/you have/i, /\bdiagnos/i, /take this (drug|medicine|pill)/i, /\bprescri/i];

test("every organ has generic urgent-care pointers", () => {
  assert.deepEqual(Object.keys(ORGAN_RED_FLAGS).sort(), [...ORGAN_IDS].sort());
  for (const [organId, flags] of Object.entries(ORGAN_RED_FLAGS)) {
    assert.ok(flags.length >= 2, `${organId} needs at least 2 pointers`);
    for (const flag of flags) {
      assert.ok(flag.length >= 10 && flag.length <= 120, `${organId}: odd length: ${flag}`);
      for (const pattern of BANNED) {
        assert.ok(!pattern.test(flag), `${organId} banned phrasing: ${flag}`);
      }
    }
  }
  for (const pattern of BANNED) {
    assert.ok(!pattern.test(EMERGENCY_LINE), `emergency line banned phrasing`);
  }
  assert.ok(/emergency services/i.test(EMERGENCY_LINE));
});
