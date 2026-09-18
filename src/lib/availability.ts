import mongoose from "mongoose";
import connectDB from "@/lib/db";
import {
  addIsoDays,
  assertCanonicalAppointmentDate,
  isAppointmentSlotPast,
  normalizeAppointmentTime,
} from "@/lib/appointment-slot";
import {
  clinicDayLabels,
  configuredSlotsOnDate,
  firstOpenDate,
  hasUploadedClinicSchedule,
  normalizeClinicSchedule,
  type ClinicDay,
} from "@/lib/clinic-hours";
import Appointment from "@/models/appointment";
import Provider from "@/models/provider";

export type TimeSlotAvailability = { time: string; label: string; available: boolean };
export type AvailabilityData = { slots: number; timeSlots: TimeSlotAvailability[] };
export type ProviderAvailability = Record<string, AvailabilityData>;

export type AvailabilityOptions = {
  excludeAppointmentId?: string;
  now?: Date;
};

function slotLabel(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

export function availabilityForBookedTimes(
  configuredSlots: string[],
  bookedTimes: string[],
  date?: string,
  now: Date = new Date(),
): AvailabilityData {
  // Treat legacy `09:00 AM` and canonical `09:00` values as the same slot.
  const booked = new Set(bookedTimes.map(normalizeAppointmentTime));
  const slots = configuredSlots.map(normalizeAppointmentTime).map((time) => ({
    time,
    label: slotLabel(time),
    available: !booked.has(time) && !(date && isAppointmentSlotPast(date, time, now)),
  }));
  return { slots: slots.filter((slot) => slot.available).length, timeSlots: slots };
}

function bookedQuery(providerId: string, dateFilter: Record<string, unknown>, excludeAppointmentId?: string) {
  const query: Record<string, unknown> = { providerId, status: "scheduled", ...dateFilter };
  if (excludeAppointmentId && mongoose.isValidObjectId(excludeAppointmentId)) {
    query._id = { $ne: excludeAppointmentId };
  }
  return query;
}

async function loadProviderSchedule(providerId: string): Promise<{ schedule: ClinicDay[]; usedDefaultHours: boolean }> {
  const provider = await Provider.findOne({ id: providerId })
    .select({ weeklyAvailability: 1 })
    .lean<{ weeklyAvailability?: Array<{ weekday: number; slots: string[] }> }>();
  if (!provider) throw new Error("Provider not found");
  return {
    schedule: normalizeClinicSchedule(provider.weeklyAvailability),
    usedDefaultHours: !hasUploadedClinicSchedule(provider.weeklyAvailability),
  };
}

export async function getAvailability(
  providerId: string,
  date: string,
  options: AvailabilityOptions = {},
): Promise<ProviderAvailability> {
  assertCanonicalAppointmentDate(date);
  await connectDB();
  const { schedule } = await loadProviderSchedule(providerId);
  const configuredSlots = configuredSlotsOnDate(schedule, date);
  const bookedAppointments = await Appointment.find(
    bookedQuery(providerId, { date }, options.excludeAppointmentId),
  )
    .select({ time: 1, _id: 0 })
    .lean<Array<{ time: string }>>();
  return {
    [date]: availabilityForBookedTimes(
      configuredSlots,
      bookedAppointments.map((appointment) => appointment.time),
      date,
      options.now,
    ),
  };
}

export async function getAvailabilityWindow(
  providerId: string,
  dates: string[],
  options: AvailabilityOptions = {},
): Promise<ProviderAvailability> {
  if (dates.length === 0) return {};
  dates.forEach(assertCanonicalAppointmentDate);
  await connectDB();
  const { schedule } = await loadProviderSchedule(providerId);
  const bookedAppointments = await Appointment.find(
    bookedQuery(providerId, { date: { $in: dates } }, options.excludeAppointmentId),
  )
    .select({ date: 1, time: 1, _id: 0 })
    .lean<Array<{ date: string; time: string }>>();
  const bookedByDate = new Map<string, string[]>();
  for (const appointment of bookedAppointments) {
    bookedByDate.set(appointment.date, [...(bookedByDate.get(appointment.date) ?? []), appointment.time]);
  }
  return Object.fromEntries(dates.map((date) => {
    const configuredSlots = configuredSlotsOnDate(schedule, date);
    return [date, availabilityForBookedTimes(configuredSlots, bookedByDate.get(date) ?? [], date, options.now)];
  }));
}

export async function getAvailabilityForDate(
  providerId: string,
  date: string,
  options: AvailabilityOptions & { seek?: boolean } = {},
) {
  assertCanonicalAppointmentDate(date);
  await connectDB();
  const { schedule, usedDefaultHours } = await loadProviderSchedule(providerId);
  const horizon = Array.from({ length: 14 }, (_, offset) => addIsoDays(date, offset));
  const dates = options.seek ? horizon : [date];
  const bookedAppointments = await Appointment.find(
    bookedQuery(providerId, { date: { $in: dates } }, options.excludeAppointmentId),
  )
    .select({ date: 1, time: 1, _id: 0 })
    .lean<Array<{ date: string; time: string }>>();
  const bookedByDate = new Map<string, string[]>();
  for (const appointment of bookedAppointments) {
    bookedByDate.set(appointment.date, [...(bookedByDate.get(appointment.date) ?? []), appointment.time]);
  }

  const resolvedDate = options.seek
    ? firstOpenDate(schedule, date, bookedByDate, 14, options.now) ?? date
    : date;
  const configuredSlots = configuredSlotsOnDate(schedule, resolvedDate);
  const availability = {
    [resolvedDate]: availabilityForBookedTimes(
      configuredSlots,
      bookedByDate.get(resolvedDate) ?? [],
      resolvedDate,
      options.now,
    ),
  };

  return {
    date: resolvedDate,
    requestedDate: date,
    clinicDays: clinicDayLabels(schedule),
    usedDefaultHours,
    availability,
  };
}

export async function getMonthAvailability(
  providerId: string,
  year: number,
  month: number,
): Promise<ProviderAvailability> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("A valid year and month are required");
  }
  await connectDB();
  const { schedule } = await loadProviderSchedule(providerId);
  const prefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  const next = new Date(Date.UTC(year, month, 1));
  const nextMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const bookedAppointments = await Appointment.find({
    providerId,
    date: { $gte: `${prefix}-01`, $lt: nextMonth },
    status: "scheduled",
  }).select({ date: 1, time: 1, _id: 0 }).lean<Array<{ date: string; time: string }>>();

  const bookedByDate = new Map<string, string[]>();
  for (const appointment of bookedAppointments) {
    const times = bookedByDate.get(appointment.date) ?? [];
    times.push(appointment.time);
    bookedByDate.set(appointment.date, times);
  }

  const result: ProviderAvailability = {};
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${prefix}-${String(day).padStart(2, "0")}`;
    const configuredSlots = configuredSlotsOnDate(schedule, date);
    result[date] = availabilityForBookedTimes(configuredSlots, bookedByDate.get(date) ?? [], date);
  }
  return result;
}
