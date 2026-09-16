import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanPacketText,
  formatPacketRange,
  formatPacketValue,
  splitSummaryBlocks,
} from "../src/lib/doctor-packet.ts";

test("cleanPacketText maps unicode to WinAnsi-safe ASCII and drops control chars", () => {
  assert.equal(cleanPacketText("0.7–1.3 “quoted” • item"), '0.7-1.3 "quoted" - item');
  assert.equal(cleanPacketText("a\x11b\x00c"), "abc");
  assert.equal(cleanPacketText("a\u00A0b\tc"), "a b c");
  assert.equal(cleanPacketText("**bold** and `code` and # hash"), "bold and code and # hash");
  assert.equal(cleanPacketText("Line 1<br>Line 2<br/>Line 3"), "Line 1\nLine 2\nLine 3");
  assert.equal(cleanPacketText(null), "");
  assert.equal(cleanPacketText(42), "");
});

test("splitSummaryBlocks detects headings, bullets, and paragraphs", () => {
  const blocks = splitSummaryBlocks(
    "1. What this report was for\n\nThis is a Kidney Function Test.\n\n- First point\n  - Nested point\n\n## Real heading",
  );
  assert.deepEqual(blocks[0], { kind: "heading", text: "1. What this report was for" });
  assert.deepEqual(blocks[1], { kind: "paragraph", text: "This is a Kidney Function Test." });
  assert.deepEqual(blocks[2], { kind: "bullet", text: "First point", depth: 0 });
  assert.deepEqual(blocks[3], { kind: "bullet", text: "Nested point", depth: 1 });
  assert.deepEqual(blocks[4], { kind: "heading", text: "Real heading" });
});

test("splitSummaryBlocks parses pipe tables and drops the separator row", () => {
  const blocks = splitSummaryBlocks(
    "2. Main findings\n\n| Test | Result | Flag |\n|------|--------|------|\n| Creatinine, Serum | 1.9 mg/dL | High |\n| eGFR | 38 mL/min | Low |",
  );
  assert.equal(blocks[0].kind, "heading");
  const table = blocks[1];
  assert.equal(table.kind, "table");
  if (table.kind !== "table") throw new Error("expected table");
  assert.deepEqual(table.header, ["Test", "Result", "Flag"]);
  assert.deepEqual(table.rows, [
    ["Creatinine, Serum", "1.9 mg/dL", "High"],
    ["eGFR", "38 mL/min", "Low"],
  ]);
});

test("splitSummaryBlocks never leaks raw markdown syntax", () => {
  const blocks = splitSummaryBlocks(
    "# Title\n\n**Bold** claim with `code`.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- item one\n- item two",
  );
  const rendered = JSON.stringify(blocks);
  assert.ok(!rendered.includes("|"), `leaked pipes: ${rendered}`);
  assert.ok(!rendered.includes("**"), `leaked emphasis: ${rendered}`);
  assert.ok(!rendered.includes("# Title"), `leaked heading marker: ${rendered}`);
});

test("long numbered sentences stay paragraphs, not headings", () => {
  const long = `1. ${"This is a very long explanatory sentence that keeps going well past any reasonable heading length. ".repeat(3)}`;
  const blocks = splitSummaryBlocks(long);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "paragraph");
});

test("formatPacketValue never joins value and unit with a slash", () => {
  assert.equal(formatPacketValue({ test: "x", value: "1.9", unit: "mg/dL", flag: "high" }), "1.9 mg/dL");
  assert.equal(formatPacketValue({ test: "x", value: "38", unit: null, flag: "low" }), "38");
});

test("formatPacketRange uses ASCII dash and handles unknowns", () => {
  assert.equal(formatPacketRange({ test: "x", value: "1", refMin: 0.7, refMax: 1.3, flag: "high" }), "0.7-1.3");
  assert.equal(formatPacketRange({ test: "x", value: "1", refMin: null, refMax: null, flag: "normal" }), "-");
  assert.equal(formatPacketRange({ test: "x", value: "1", refMin: 60, refMax: null, flag: "low" }), "60-?");
});
