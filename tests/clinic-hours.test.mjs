import assert from "node:assert/strict";
import test from "node:test";
import {
  clinicDayLabels,
  configuredSlotsOnDate,
  DEFAULT_CLINIC_SLOTS,
  firstOpenDate,
  hasUploadedClinicSchedule,
  normalizeClinicSchedule,
} from "../src/lib/clinic-hours.ts";

test("empty uploaded hours fall back to weekday clinic defaults", () => {
  assert.equal(hasUploadedClinicSchedule([]), false);
  const schedule = normalizeClinicSchedule([]);
  assert.deepEqual(configuredSlotsOnDate(schedule, "2026-09-21"), DEFAULT_CLINIC_SLOTS);
  assert.deepEqual(configuredSlotsOnDate(schedule, "2026-09-19"), []);
  assert.equal(clinicDayLabels(schedule), "Monday, Tuesday, Wednesday, Thursday, Friday");
});

test("uploaded hours keep closed weekdays closed and coerce weekday types", () => {
  const schedule = normalizeClinicSchedule([
    { weekday: "2", slots: ["10:00", "11:00"] },
    { weekday: 4, slots: ["15:00"] },
  ]);
  assert.equal(hasUploadedClinicSchedule([{ weekday: 2, slots: ["10:00"] }]), true);
  assert.deepEqual(configuredSlotsOnDate(schedule, "2026-09-22"), ["10:00", "11:00"]);
  assert.deepEqual(configuredSlotsOnDate(schedule, "2026-09-24"), ["15:00"]);
  assert.deepEqual(configuredSlotsOnDate(schedule, "2026-09-21"), []);
});

test("first open date skips elapsed today slots and closed weekend days", () => {
  const schedule = normalizeClinicSchedule([
    { weekday: 1, slots: ["09:00", "10:00", "11:00", "14:00", "15:00"] },
    { weekday: 2, slots: ["09:00", "10:00", "11:00", "14:00", "15:00"] },
    { weekday: 3, slots: ["09:00", "10:00", "11:00", "14:00", "15:00"] },
    { weekday: 4, slots: ["09:00", "10:00", "11:00", "14:00", "15:00"] },
    { weekday: 5, slots: ["09:00", "10:00", "11:00", "14:00", "15:00"] },
  ]);
  const fridayEvening = new Date("2026-09-18T11:15:00.000Z");
  assert.equal(firstOpenDate(schedule, "2026-09-18", new Map(), 14, fridayEvening), "2026-09-21");
});
