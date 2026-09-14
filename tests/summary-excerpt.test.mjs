import test from "node:test";
import assert from "node:assert/strict";
import { toPlainExcerpt } from "../src/lib/summary-excerpt.ts";

test("strips bold, headings, lists and tables", () => {
  const out = toPlainExcerpt(
    "## Findings\n**Hemoglobin:** 10.8 g/dL\n- low value\n| a | b |\n# Title",
    500,
  );
  assert.ok(!/[*#|]/.test(out), `leaked markdown: ${out}`);
  assert.ok(out.includes("Hemoglobin: 10.8 g/dL"));
  assert.ok(out.includes("low value"));
});

test("keeps short text intact and truncates long text at words", () => {
  assert.equal(toPlainExcerpt("Normal result."), "Normal result.");
  assert.equal(toPlainExcerpt(null), "");
  const long = `word ${"filler ".repeat(100)}end`;
  const out = toPlainExcerpt(long, 50);
  assert.ok(out.length <= 51);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.includes("end"));
});

test("handles the real report style without asterisks", () => {
  const out = toPlainExcerpt(
    "**🔹 Patient Details** - Name: Singh, Karan\n**3. What do these findings mean?** It's important.",
    500,
  );
  assert.ok(!out.includes("**"), out);
  assert.ok(out.includes("Singh, Karan"));
});
