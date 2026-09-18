import test from "node:test";
import assert from "node:assert/strict";
import { classifyRecordChat, compactChatHistory } from "../src/lib/record-chat.ts";

test("routes emergencies and diagnosis away from the model", () => {
  assert.equal(classifyRecordChat("I have crushing chest pain").kind, "emergency");
  assert.equal(classifyRecordChat("do I have anemia?").kind, "diagnosis");
});

test("routes last two / latest / first-ever as record lookups", () => {
  assert.equal(classifyRecordChat("results from the last two reports").kind, "record");
  assert.equal(classifyRecordChat("what is in my most recent report").kind, "record");
  assert.equal(classifyRecordChat("tell me about my first-ever report").kind, "record");
  assert.equal(classifyRecordChat("results from the last two reports").recordIntent.scope.type, "last_n");
  assert.equal(classifyRecordChat("my first-ever report").recordIntent.scope.type, "oldest");
});

test("keeps general education off the patient labs", () => {
  const route = classifyRecordChat("What is LDL cholesterol?");
  assert.equal(route.kind, "general_education");
  assert.equal(route.attachReports, false);
  assert.equal(route.attachLabs, false);
});

test("splits personal results plus how-to into mixed", () => {
  const route = classifyRecordChat("Is my cholesterol high and how can I lower it?");
  assert.equal(route.kind, "mixed");
  assert.equal(route.attachReports, true);
});

test("routes meds and appointments without pulling every report", () => {
  const meds = classifyRecordChat("What medications am I on?");
  assert.equal(meds.kind, "navigation");
  assert.equal(meds.attachMeds, true);
  assert.equal(meds.attachReports, false);
  const visits = classifyRecordChat("Do I have any upcoming appointments?");
  assert.equal(visits.kind, "navigation");
  assert.equal(visits.attachAppointments, true);
});

test("rejects unrelated tasks instead of answering from labs", () => {
  assert.equal(classifyRecordChat("Write me a python script to scrape stock prices").kind, "out_of_scope");
});

test("compacts chat history so older turns cannot blow the window", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `${index}:` + "x".repeat(2_000),
  }));
  const compact = compactChatHistory(messages);
  assert.ok(compact.length <= 8);
  assert.ok(compact.reduce((total, message) => total + message.content.length, 0) <= 4_000);
  assert.match(compact.at(-1).content, /^19:/);
});
