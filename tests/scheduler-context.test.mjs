import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedSchedulerMessages,
  canonicalizeSchedulerResponse,
  compactSchedulerReports,
  extractSchedulerTaggedJson,
  extractSuggestedDoctors,
  formatLooseSlotListing,
  formatVerifiedSlotsForPrompt,
  guardUnverifiedBookingClaim,
  replaceRelativeSchedulerDates,
  resolveRelativeBookingDate,
  stripSchedulerMetadata,
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

test("scheduler protocol accepts fenced JSON and removes the complete metadata block", () => {
  const response = 'Ready.\n\nBOOKING_READY ```json\n{"providerId":"dr-johnson","reason":"regular checkup"}\n```\n\nDisclaimer.';
  assert.deepEqual(extractSchedulerTaggedJson(response, "BOOKING_READY"), {
    providerId: "dr-johnson",
    reason: "regular checkup",
  });
  const clean = stripSchedulerMetadata(response);
  assert.match(clean, /Ready/);
  assert.match(clean, /Disclaimer/);
  assert.doesNotMatch(clean, /```|BOOKING_READY|dr-johnson/);
});

test("scheduler maps today and tomorrow to different clinic dates", () => {
  const response = replaceRelativeSchedulerDates(
    "I can see you tomorrow at 08:30 instead of today.",
    "2026-09-17",
  );
  assert.equal(response, "I can see you 2026-09-18 at 08:30 instead of 2026-09-17.");
});

test("scheduler recovers doctor JSON that leaked without a SUGGESTED_DOCTORS tag", () => {
  const leaked = `I recommend seeing Dr. Sarah Smith for a regular heart check-up. **** json [ { "id": "dr-smith", "name": "Dr. Sarah Smith", "specialty": "Cardiology", "justification": "Cardiology specialist with available slots." } ] Which date works?`;
  const doctors = extractSuggestedDoctors(leaked);
  assert.equal(doctors.length, 1);
  assert.equal(doctors[0].id, "dr-smith");
  const clean = stripSchedulerMetadata(leaked);
  assert.match(clean, /Dr\. Sarah Smith/);
  assert.doesNotMatch(clean, /dr-smith|"specialty"|json \[/);
});

test("scheduler canonicalizes leaked doctor JSON so the UI can render cards", () => {
  const leaked = `I recommend Dr. Sarah Smith. **** json [{"id":"dr-smith","name":"Dr. Sarah Smith","specialty":"Cardiology","justification":"Heart specialist"}]`;
  const canonical = canonicalizeSchedulerResponse({
    prose: leaked,
    doctors: extractSuggestedDoctors(leaked),
  });
  assert.deepEqual(extractSchedulerTaggedJson(canonical, "SUGGESTED_DOCTORS"), [{
    id: "dr-smith",
    name: "Dr. Sarah Smith",
    specialty: "Cardiology",
    justification: "Heart specialist",
  }]);
  assert.doesNotMatch(stripSchedulerMetadata(canonical), /\[\{/);
});

test("scheduler formats cramped slot lists as one time per line", () => {
  const formatted = formatLooseSlotListing("Here are the slots:\n2026-09-18 10:00 2026-09-18 11:00 2026-09-19 09:00");
  assert.match(formatted, /\*\*Friday, 18 September 2026\*\*/);
  assert.match(formatted, /- 10:00/);
  assert.match(formatted, /- 11:00/);
  assert.match(formatted, /\*\*Saturday, 19 September 2026\*\*/);
});

test("scheduler prompt slots are grouped under each provider and date", () => {
  const text = formatVerifiedSlotsForPrompt(
    [{ providerId: "dr-smith", slots: [{ date: "2026-09-19", time: "10:00" }, { date: "2026-09-19", time: "11:00" }] }],
    [{ id: "dr-smith", name: "Dr. Sarah Smith" }],
  );
  assert.match(text, /Dr\. Sarah Smith \(dr-smith\)/);
  assert.match(text, /Saturday, 19 September 2026/);
  assert.match(text, /    - 10:00/);
});

test("tomorrow in the user request wins over a today-dated proposal", () => {
  assert.equal(resolveRelativeBookingDate("book tomorrow at 10 am", "2026-09-18", "2026-09-18"), "2026-09-19");
  assert.equal(resolveRelativeBookingDate("book today at 10 am", "2026-09-19", "2026-09-18"), "2026-09-18");
  assert.equal(resolveRelativeBookingDate("yes please", "2026-09-21", "2026-09-18"), "2026-09-21");
});
