import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";
import Appointment from "@/models/appointment";
import { auth } from "@clerk/nextjs/server";
import LabResult from "@/models/labResult";
import Medication from "@/models/medication";
import { getReportQuota } from "@/lib/report-quota";

type UserAppointment = {
  _id: string;
  status: string;
  date: string;
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 },
      );
    }

    await connectDB();

    const today = new Date().toISOString().split("T")[0];

    const recentReports = await Report.find({ userId })
      .select({ summary: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const appointments = await Appointment.find({ patientId: userId })
      .sort({ date: -1 })
      .lean<UserAppointment[]>();

    const upcomingAppointments = appointments
      .filter(
        (appointment) =>
          appointment.status === "scheduled" && appointment.date >= today,
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    const [totalReports, latestAbnormalLabs, activeMedicationCount, quota] = await Promise.all([
      Report.countDocuments({ userId }),
      LabResult.find({ userId, flag: { $in: ["high", "low"] } })
        .select({ canonicalName: 1, value: 1, unit: 1, flag: 1, date: 1 })
        .sort({ date: -1 })
        .limit(3)
        .lean(),
      Medication.countDocuments({ userId, status: "active" }),
      getReportQuota(userId),
    ]);

    return NextResponse.json({
      recentReports: JSON.parse(JSON.stringify(recentReports)),
      appointments: JSON.parse(JSON.stringify(appointments)),
      upcomingAppointments: JSON.parse(JSON.stringify(upcomingAppointments)),
      metrics: {
        totalReports,
        totalAppointments: appointments.length,
        upcomingAppointments: upcomingAppointments.length,
        completedAppointments: appointments.filter(
          (appointment) => appointment.status === "completed",
        ).length,
      },
      latestAbnormalLabs: JSON.parse(JSON.stringify(latestAbnormalLabs)),
      activeMedicationCount,
      plan: quota.entitlements.plan,
      reportQuota: { used: quota.used, limit: quota.limit },
    });
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching user data." },
      { status: 500 },
    );
  }
}
