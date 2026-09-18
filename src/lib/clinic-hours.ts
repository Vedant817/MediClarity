import {
  addIsoDays,
  isAppointmentSlotPast,
  isCanonicalAppointmentTime,
  normalizeAppointmentTime,
} from "./appointment-slot.ts";

export type ClinicDay = { weekday: number; slots: string[] };

/** Used when a provider exists but has no uploaded weekly schedule. */
export const DEFAULT_CLINIC_SLOTS = ["09:00", "10:00", "11:00", "14:00", "15:00"];
export const DEFAULT_CLINIC_SCHEDULE: ClinicDay[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  slots: [...DEFAULT_CLINIC_SLOTS],
}));

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayUtc(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function uploadedClinicSchedule(
  weeklyAvailability?: Array<{ weekday?: unknown; slots?: unknown }> | null,
): ClinicDay[] {
  return (weeklyAvailability ?? [])
    .map((entry) => {
      const weekday = Number(entry.weekday);
      const slots = (Array.isArray(entry.slots) ? entry.slots : [])
        .filter((slot): slot is string => typeof slot === "string")
        .map(normalizeAppointmentTime)
        .filter(isCanonicalAppointmentTime);
      return { weekday, slots };
    })
    .filter((entry) => Number.isInteger(entry.weekday) && entry.weekday >= 0 && entry.weekday <= 6 && entry.slots.length > 0);
}

export function hasUploadedClinicSchedule(
  weeklyAvailability?: Array<{ weekday?: unknown; slots?: unknown }> | null,
): boolean {
  return uploadedClinicSchedule(weeklyAvailability).length > 0;
}

export function normalizeClinicSchedule(
  weeklyAvailability?: Array<{ weekday?: unknown; slots?: unknown }> | null,
): ClinicDay[] {
  const uploaded = uploadedClinicSchedule(weeklyAvailability);
  return uploaded.length > 0 ? uploaded : DEFAULT_CLINIC_SCHEDULE;
}

export function configuredSlotsOnDate(schedule: ClinicDay[], date: string): string[] {
  const weekday = weekdayUtc(date);
  return schedule.find((entry) => entry.weekday === weekday)?.slots ?? [];
}

export function clinicDayLabels(schedule: ClinicDay[]): string {
  const days = [...new Set(schedule.map((entry) => entry.weekday))].sort((left, right) => left - right);
  return days.map((day) => WEEKDAY_NAMES[day] ?? String(day)).join(", ");
}

export function firstOpenDate(
  schedule: ClinicDay[],
  startDate: string,
  bookedByDate: Map<string, string[]>,
  days = 14,
  now = new Date(),
): string | null {
  for (let offset = 0; offset < days; offset += 1) {
    const date = addIsoDays(startDate, offset);
    const booked = new Set((bookedByDate.get(date) ?? []).map(normalizeAppointmentTime));
    const open = configuredSlotsOnDate(schedule, date).some(
      (time) => !booked.has(time) && !isAppointmentSlotPast(date, time, now),
    );
    if (open) return date;
  }
  return null;
}
