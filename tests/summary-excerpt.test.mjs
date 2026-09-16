import test from "node:test";
import assert from "node:assert/strict";
import { stripMarkdownForSpeech, toCaptionExcerpt, toPlainExcerpt } from "../src/lib/summary-excerpt.ts";

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

test("speech text drops table separators and pipes without truncating", () => {
  const markdown = [
    "## Main findings",
    "",
    "| Parameter | Result | Flag |",
    "| --- | --- | --- |",
    "| Hemoglobin | 10.8 g/dL | **low** |",
    "",
    "- anemia possible",
    "<b>note</b>",
  ].join("\n");
  const out = stripMarkdownForSpeech(markdown);
  assert.ok(!out.includes("---"), out);
  assert.ok(!out.includes("|"), out);
  assert.ok(!out.includes("**"), out);
  assert.ok(!out.includes("<b>"), out);
  assert.ok(out.includes("Hemoglobin, 10.8 g/dL, low"), out);
  assert.ok(out.includes("Main findings"), out);
  assert.ok(out.length > 50, "must keep full text, not an excerpt");
  assert.equal(stripMarkdownForSpeech(null), "");
  assert.equal(stripMarkdownForSpeech(42), "");
});

test("toCaptionExcerpt joins section label and opening sentence readably", () => {
  const out = toCaptionExcerpt(
    "1. What this report was for\nThis is a combined thyroid-function and diabetes screening panel.\n\n2. Main findings\n\n| Test | Result |\n|---|---|\n| TSH | 9.4 |",
  );
  assert.ok(!out.includes("|"), `leaked pipes: ${out}`);
  assert.ok(!out.includes("---"), `leaked separator: ${out}`);
  assert.ok(
    out.startsWith("What this report was for — This is a combined"),
    `unexpected caption: ${out}`,
  );
});

test("toCaptionExcerpt truncates long captions at word boundaries", () => {
  const out = toCaptionExcerpt(`Summary paragraph ${"with filler words ".repeat(60)}end.`, 60);
  assert.ok(out.length <= 61, out);
  assert.ok(out.endsWith("…"), out);
  assert.equal(toCaptionExcerpt(""), "");
  assert.equal(toCaptionExcerpt(null), "");
});
