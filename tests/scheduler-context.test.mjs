import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedSchedulerMessages,
  compactSchedulerReports,
} from "../src/lib/scheduler-context.ts";

test("scheduler report context is bounded", () => {
  const reports = Array.from({ length: 5 }, (_, index) => ({
    sourceLab: `Lab ${index}`,
    summary: "x".repeat(2_000),
  }));
  const compact = compactSchedulerReports(reports);
  assert.equal(compact.length, 3);
  assert.ok(compact.every((report) => report.summary.length <= 700));
});

test("scheduler keeps newest conversation turns within budget", () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `${index}:` + "x".repeat(1_500),
  }));
  const bounded = boundedSchedulerMessages(messages);
  assert.ok(bounded.length <= 10);
  assert.ok(bounded.reduce((total, message) => total + message.content.length, 0) <= 6_000);
  assert.match(bounded.at(-1).content, /^11:/);
});
