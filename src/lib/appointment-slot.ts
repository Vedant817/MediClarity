const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function appointmentDateInTimeZone(
  value: Date = new Date(),
  timeZone = process.env.APPOINTMENT_TIME_ZONE?.trim() || "Asia/Kolkata",
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function clinicTimeZone(): string {
  return process.env.APPOINTMENT_TIME_ZONE?.trim() || "Asia/Kolkata";
}

export function appointmentTimeInTimeZone(
  value: Date = new Date(),
  timeZone = clinicTimeZone(),
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
}

export function clinicClock(
  value: Date = new Date(),
  timeZone = clinicTimeZone(),
): { timeZone: string; date: string; time: string; tomorrow: string } {
  const date = appointmentDateInTimeZone(value, timeZone);
  return {
    timeZone,
    date,
    time: appointmentTimeInTimeZone(value, timeZone),
    tomorrow: addIsoDays(date, 1),
  };
}

export function addIsoDays(isoDate: string, days: number): string {
  assertCanonicalAppointmentDate(isoDate);
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function upcomingAppointmentDates(
  count: number,
  value: Date = new Date(),
  timeZone = clinicTimeZone(),
): string[] {
  const firstDate = appointmentDateInTimeZone(value, timeZone);
  const [year, month, day] = firstDate.split("-").map(Number);
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - 1, day + offset));
    return date.toISOString().slice(0, 10);
  });
}

/** True when the clinic-local slot has already started or passed. */
export function isAppointmentSlotPast(
  date: string,
  time: string,
  value: Date = new Date(),
  timeZone = clinicTimeZone(),
): boolean {
  const clock = clinicClock(value, timeZone);
  const normalized = normalizeAppointmentTime(time);
  if (date < clock.date) return true;
  if (date > clock.date) return false;
  return normalized <= clock.time;
}

export function isCanonicalAppointmentDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function assertCanonicalAppointmentDate(value: string): string {
  if (!isCanonicalAppointmentDate(value)) throw new Error("Appointment date must be a valid YYYY-MM-DD date");
  return value;
}

export function normalizeAppointmentTime(value: string): string {
  const trimmed = value.trim();
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) return trimmed;

  const legacyMatch = trimmed.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!legacyMatch) return trimmed;

  let hour = Number(legacyMatch[1]);
  if (hour < 1 || hour > 12) return trimmed;
  const period = legacyMatch[3].toUpperCase();
  if (period === "AM") hour %= 12;
  else if (hour !== 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${legacyMatch[2]}`;
}

export function isCanonicalAppointmentTime(value: string): boolean {
  const normalized = normalizeAppointmentTime(value);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized);
}

export function formatSlotTimeLabel(value: string): string {
  const normalized = normalizeAppointmentTime(value);
  const [hours, minutes] = normalized.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

export function appointmentTimeVariants(value: string): string[] {
  const normalized = normalizeAppointmentTime(value);
  const legacyLabel = formatSlotTimeLabel(normalized);
  return Array.from(new Set([normalized, value.trim(), legacyLabel].filter(Boolean) as string[]));
}
