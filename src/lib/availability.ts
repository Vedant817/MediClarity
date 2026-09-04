import connectDB from "@/lib/db";
import { assertCanonicalAppointmentDate, normalizeAppointmentTime } from "@/lib/appointment-slot";
import Appointment from "@/models/appointment";
import Provider from "@/models/provider";

export type TimeSlotAvailability = { time: string; label: string; available: boolean };
export type AvailabilityData = { slots: number; timeSlots: TimeSlotAvailability[] };
export type ProviderAvailability = Record<string, AvailabilityData>;

function slotLabel(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

function availabilityForBookedTimes(configuredSlots: string[], bookedTimes: string[]): AvailabilityData {
  // Treat legacy `09:00 AM` and canonical `09:00` values as the same slot.
  const booked = new Set(bookedTimes.map(normalizeAppointmentTime));
  const slots = configuredSlots.map(normalizeAppointmentTime).map((time) => ({
    time,
    label: slotLabel(time),
    available: !booked.has(time),
  }));
  return { slots: slots.filter((slot) => slot.available).length, timeSlots: slots };
}

export async function getAvailability(providerId: string, date: string): Promise<ProviderAvailability> {
  assertCanonicalAppointmentDate(date);
  await connectDB();
  const provider = await Provider.findOne({ id: providerId, acceptingNewPatients: true })
    .select({ weeklyAvailability: 1 })
    .lean<{ weeklyAvailability?: Array<{ weekday: number; slots: string[] }> }>();
  if (!provider) throw new Error("Provider not found or not accepting appointments");
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const configuredSlots = provider.weeklyAvailability?.find((entry) => entry.weekday === weekday)?.slots ?? [];
  const bookedAppointments = await Appointment.find({ providerId, date, status: "scheduled" })
    .select({ time: 1, _id: 0 })
    .lean<Array<{ time: string }>>();
  return { [date]: availabilityForBookedTimes(configuredSlots, bookedAppointments.map((appointment) => appointment.time)) };
}

export async function getAvailabilityWindow(providerId: string, dates: string[]): Promise<ProviderAvailability> {
  if (dates.length === 0) return {};
  dates.forEach(assertCanonicalAppointmentDate);
  await connectDB();
  const provider = await Provider.findOne({ id: providerId, acceptingNewPatients: true })
    .select({ weeklyAvailability: 1 })
    .lean<{ weeklyAvailability?: Array<{ weekday: number; slots: string[] }> }>();
  if (!provider) throw new Error("Provider not found or not accepting appointments");
  const bookedAppointments = await Appointment.find({ providerId, date: { $in: dates }, status: "scheduled" })
    .select({ date: 1, time: 1, _id: 0 })
    .lean<Array<{ date: string; time: string }>>();
  const bookedByDate = new Map<string, string[]>();
  for (const appointment of bookedAppointments) {
    bookedByDate.set(appointment.date, [...(bookedByDate.get(appointment.date) ?? []), appointment.time]);
  }
  return Object.fromEntries(dates.map((date) => {
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const configuredSlots = provider.weeklyAvailability?.find((entry) => entry.weekday === weekday)?.slots ?? [];
    return [date, availabilityForBookedTimes(configuredSlots, bookedByDate.get(date) ?? [])];
  }));
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
  const provider = await Provider.findOne({ id: providerId, acceptingNewPatients: true })
    .select({ weeklyAvailability: 1 })
    .lean<{ weeklyAvailability?: Array<{ weekday: number; slots: string[] }> }>();
  if (!provider) throw new Error("Provider not found or not accepting appointments");
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
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const configuredSlots = provider.weeklyAvailability?.find((entry) => entry.weekday === weekday)?.slots ?? [];
    result[date] = availabilityForBookedTimes(configuredSlots, bookedByDate.get(date) ?? []);
  }
  return result;
}
