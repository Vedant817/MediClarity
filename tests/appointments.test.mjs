import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionAppointmentStatus,
  isTerminalStatus,
  normalizeAppointmentStatus,
  PATIENT_SETTABLE_STATUSES,
} from "../src/lib/appointments.ts";

test("legacy completed reads as attended", () => {
  assert.equal(normalizeAppointmentStatus("completed"), "attended");
  assert.equal(normalizeAppointmentStatus("attended"), "attended");
  assert.equal(normalizeAppointmentStatus("scheduled"), "scheduled");
  assert.equal(normalizeAppointmentStatus("cancelled"), "cancelled");
  assert.equal(normalizeAppointmentStatus("unattended"), "unattended");
  assert.equal(normalizeAppointmentStatus("bogus"), null);
  assert.equal(normalizeAppointmentStatus(null), null);
});

test("terminal states include every visit outcome", () => {
  for (const status of ["attended", "cancelled", "unattended", "completed"]) {
    assert.equal(isTerminalStatus(status), true);
  }
  assert.equal(isTerminalStatus("scheduled"), false);
  assert.equal(isTerminalStatus("bogus"), false);
});

test("patients can only move scheduled visits to an outcome", () => {
  for (const to of PATIENT_SETTABLE_STATUSES) {
    assert.equal(canTransitionAppointmentStatus("scheduled", to), true);
  }
  assert.equal(canTransitionAppointmentStatus("scheduled", "scheduled"), false);
  assert.equal(canTransitionAppointmentStatus("scheduled", "completed"), false);
  for (const from of ["attended", "cancelled", "unattended", "completed"]) {
    assert.equal(canTransitionAppointmentStatus(from, "cancelled"), false);
    assert.equal(canTransitionAppointmentStatus(from, "attended"), false);
  }
});
