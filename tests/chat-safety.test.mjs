import test from "node:test";
import assert from "node:assert/strict";
import { DIAGNOSIS_REFUSAL, isDiagnosisSeeking } from "../src/lib/chat-safety.ts";
import { mentionsKnownLab } from "../src/lib/labs.ts";

test("refuses condition questions deterministically", () => {
  assert.equal(isDiagnosisSeeking("Do I have anemia? yes or no"), true);
  assert.equal(isDiagnosisSeeking("DO I HAVE ANEMIA?"), true);
  assert.equal(isDiagnosisSeeking("do i have cancer"), true);
  assert.equal(isDiagnosisSeeking("do i have covid-19?"), true);
  assert.equal(isDiagnosisSeeking("do i have type 2 diabetes?"), true);
  assert.equal(isDiagnosisSeeking("please diagnose me"), true);
  assert.equal(isDiagnosisSeeking("am I diagnosed with anything?"), true);
  assert.equal(isDiagnosisSeeking("do i suffer from asthma"), true);
  assert.equal(isDiagnosisSeeking("have I got anemia?"), true);
  assert.equal(isDiagnosisSeeking("could I have diabetes?"), true);
  assert.equal(isDiagnosisSeeking("is it possible I have cancer?"), true);
  assert.equal(isDiagnosisSeeking("I think I have diabetes, confirm?"), true);
  assert.equal(isDiagnosisSeeking("what do I have?"), true);
  assert.equal(isDiagnosisSeeking("do I have?"), true);
});

test("refuses rephrased and multi-part condition questions", () => {
  assert.equal(isDiagnosisSeeking("Can you tell me if I have diabetes"), true);
  assert.equal(isDiagnosisSeeking("tell me whether i have cancer"), true);
  assert.equal(isDiagnosisSeeking("do you think I might have cancer?"), true);
  assert.equal(isDiagnosisSeeking("whether I might have anemia?"), true);
  assert.equal(isDiagnosisSeeking("should I worry I have diabetes"), true);
  assert.equal(isDiagnosisSeeking("do I have low hemoglobin? do I have cancer?"), true);
  assert.equal(isDiagnosisSeeking("do I have cancer\nand diabetes?"), true);
  assert.equal(isDiagnosisSeeking("do i have ms?"), true);
  assert.equal(isDiagnosisSeeking("do i have tb?"), true);
  assert.equal(isDiagnosisSeeking("do I have early stage cancer?"), true);
});

test("refuses mixed questions where the condition must win", () => {
  assert.equal(isDiagnosisSeeking("do I have anemia and low hemoglobin?"), true);
  assert.equal(isDiagnosisSeeking("do I have cancer with high LDL?"), true);
  assert.equal(isDiagnosisSeeking("do I have an appointment AND cancer?"), true);
});

test("lets lab-value questions through to the record", () => {
  assert.equal(isDiagnosisSeeking("Do I have low hemoglobin?"), false);
  assert.equal(isDiagnosisSeeking("what was my hemoglobin value?"), false);
  assert.equal(isDiagnosisSeeking("do I have high LDL?"), false);
  assert.equal(isDiagnosisSeeking("is my creatinine 1.9?"), false);
  assert.equal(isDiagnosisSeeking("do I have low hemoglobin and high LDL?"), false);
});

test("lets admin and instruction questions through", () => {
  assert.equal(isDiagnosisSeeking("Do I have any upcoming appointments?"), false);
  assert.equal(isDiagnosisSeeking("do I have a visit tomorrow?"), false);
  assert.equal(isDiagnosisSeeking("do I have my medications?"), false);
  assert.equal(isDiagnosisSeeking("do I have a bill?"), false);
  assert.equal(isDiagnosisSeeking("do I have to fast before my test?"), false);
  assert.equal(isDiagnosisSeeking("do I have any reports?"), false);
  assert.equal(isDiagnosisSeeking("What is the issue in my latest report"), false);
  assert.equal(isDiagnosisSeeking("what do I have to bring to my visit?"), false);
  assert.equal(isDiagnosisSeeking(""), false);
  assert.equal(isDiagnosisSeeking(null), false);
});

test("known-lab vocabulary behaves for the gate", () => {
  assert.equal(mentionsKnownLab("hemoglobin"), true);
  assert.equal(mentionsKnownLab("my LDL-C value"), true);
  assert.equal(mentionsKnownLab("anemia"), false);
  assert.equal(mentionsKnownLab("cancer"), false);
});

test("refusal text is the exact contract string", () => {
  assert.equal(DIAGNOSIS_REFUSAL, "Not in report - ask your doctor");
});
