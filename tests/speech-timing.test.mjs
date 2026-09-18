import assert from "node:assert/strict";
import test from "node:test";
import { speechWatchdogMs } from "../src/lib/speech-timing.ts";

test("speech watchdog allows a complete spoken medical answer", () => {
  const answer = "Your recent reports include several findings that need clinician review. I cannot choose a procedure, but I can summarize the available results and help you decide what to discuss at your appointment. This is health information, not medical advice.";
  assert.ok(speechWatchdogMs(answer) > 20_000);
});

test("speech watchdog remains bounded for short and very long text", () => {
  assert.equal(speechWatchdogMs("Hello."), 12_000);
  assert.equal(speechWatchdogMs("word ".repeat(10_000)), 90_000);
});
