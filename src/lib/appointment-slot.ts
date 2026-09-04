const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export function appointmentTimeVariants(value: string): string[] {
  const normalized = normalizeAppointmentTime(value);
  const [hours, minutes] = normalized.split(":").map(Number);
  const legacyLabel = Number.isFinite(hours) && Number.isFinite(minutes)
    ? `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`
    : undefined;
  return Array.from(new Set([normalized, value.trim(), legacyLabel].filter(Boolean) as string[]));
}
