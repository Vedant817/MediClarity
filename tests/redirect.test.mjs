import test from "node:test";
import assert from "node:assert/strict";
import { safeRedirectTarget } from "../src/lib/redirect.ts";

test("accepts same-origin app paths", () => {
  assert.equal(safeRedirectTarget("/pricing"), "/pricing");
  assert.equal(safeRedirectTarget("/dashboard/reports"), "/dashboard/reports");
});

test("rejects open redirects and falls back to the dashboard", () => {
  assert.equal(safeRedirectTarget(null), "/dashboard");
  assert.equal(safeRedirectTarget(undefined), "/dashboard");
  assert.equal(safeRedirectTarget(""), "/dashboard");
  assert.equal(safeRedirectTarget("//evil.com/x"), "/dashboard");
  assert.equal(safeRedirectTarget("https://evil.com"), "/dashboard");
  assert.equal(safeRedirectTarget("/\\evil"), "/dashboard");
  assert.equal(safeRedirectTarget("javascript:alert(1)"), "/dashboard");
});
