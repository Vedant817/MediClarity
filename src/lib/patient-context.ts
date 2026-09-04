import connectDB from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import Appointment from "@/models/appointment";
import LabResult from "@/models/labResult";
import Medication from "@/models/medication";
import Report from "@/models/report";
import UserPreference from "@/models/userPreference";

const REPORT_LIMIT = 5;
const LAB_LIMIT = 50;
const MEDICATION_LIMIT = 25;
const APPOINTMENT_LIMIT = 10;
const SUMMARY_CHARACTER_LIMIT = 2_500;

interface VoicePreferences {
  locale?: string;
  regionProfile?: string;
  dateFormat?: string;
}

function boundedText(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

export async function getPatientVoiceContext(userId: string) {
  if (!userId) throw new Error("A user is required to load patient context");
  await connectDB();
  const today = new Date().toISOString().slice(0, 10);

  const [reports, labs, medications, appointments, preferences, profile] = await Promise.all([
    Report.find({ userId })
      .select({ summary: 1, reportDate: 1, createdAt: 1, sourceLab: 1, _id: 0 })
      .sort({ reportDate: -1, createdAt: -1 })
      .limit(REPORT_LIMIT)
      .lean(),
    LabResult.find({ userId })
      .select({ canonicalName: 1, value: 1, unit: 1, refMin: 1, refMax: 1, flag: 1, date: 1, _id: 0 })
      .sort({ date: -1 })
      .limit(LAB_LIMIT)
      .lean(),
    Medication.find({ userId, status: "active" })
      .select({ name: 1, dose: 1, frequency: 1, startDate: 1, _id: 0 })
      .sort({ updatedAt: -1 })
      .limit(MEDICATION_LIMIT)
      .lean(),
    Appointment.find({ patientId: userId, status: "scheduled", date: { $gte: today } })
      .select({ providerId: 1, appointmentType: 1, date: 1, time: 1, _id: 0 })
      .sort({ date: 1, time: 1 })
      .limit(APPOINTMENT_LIMIT)
      .lean(),
    UserPreference.findOne({ userId })
      .select({ locale: 1, regionProfile: 1, dateFormat: 1, _id: 0 })
      .lean<VoicePreferences | null>(),
    clerkClient()
      .then((client) => client.users.getUser(userId))
      .then((user) => ({ firstName: user.firstName, lastName: user.lastName }))
      .catch(() => null),
  ]);

  const displayName = profile
    ? boundedText([profile.firstName, profile.lastName].filter(Boolean).join(" "), 100)
    : null;

  return {
    generatedAt: new Date().toISOString(),
    displayName,
    preferences: {
      locale: preferences?.locale ?? "en",
      regionProfile: preferences?.regionProfile ?? "GLOBAL",
      dateFormat: preferences?.dateFormat ?? "YYYY-MM-DD",
    },
    recentReports: reports.map((report) => ({
      summary: boundedText(report.summary, SUMMARY_CHARACTER_LIMIT),
      reportDate: report.reportDate?.toISOString() ?? report.createdAt?.toISOString() ?? null,
      sourceLab: boundedText(report.sourceLab, 160),
    })),
    recentLabs: labs.map((lab) => ({
      test: boundedText(lab.canonicalName, 160),
      value: lab.value,
      unit: boundedText(lab.unit, 40),
      referenceRange: {
        min: lab.refMin ?? null,
        max: lab.refMax ?? null,
      },
      flag: lab.flag,
      date: lab.date.toISOString(),
    })),
    activeMedications: medications.map((medication) => ({
      name: boundedText(medication.name, 200),
      dose: boundedText(medication.dose, 100),
      frequency: boundedText(medication.frequency, 160),
      startDate: medication.startDate?.toISOString() ?? null,
    })),
    upcomingAppointments: appointments.map((appointment) => ({
      providerId: boundedText(appointment.providerId, 128),
      appointmentType: boundedText(appointment.appointmentType, 80),
      date: appointment.date,
      time: appointment.time,
    })),
  };
}
