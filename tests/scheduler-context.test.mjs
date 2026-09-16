import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedSchedulerMessages,
  compactSchedulerReports,
  guardUnverifiedBookingClaim,
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

test("scheduler blocks confirmation claims without a booking payload", () => {
  const guarded = guardUnverifiedBookingClaim(
    "Your appointment is confirmed! We'll send you a reminder shortly.",
  );
  assert.match(guarded, /has not been booked yet/i);
  assert.doesNotMatch(guarded, /reminder/i);
});

test("scheduler preserves a valid proposal but does not call it booked", () => {
  const payload = 'BOOKING_READY {"providerId":"dr-smith","date":"2026-09-17","time":"10:00"}';
  const guarded = guardUnverifiedBookingClaim(`Your appointment is confirmed!\n${payload}`);
  assert.match(guarded, /Select Schedule Appointment/i);
  assert.match(guarded, /BOOKING_READY/);
  assert.doesNotMatch(guarded, /appointment is confirmed/i);
});
