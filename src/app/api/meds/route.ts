import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import connectDB from "@/lib/db";
import Medication from "@/models/medication";
import Report from "@/models/report";
import { getEntitlements } from "@/lib/entitlements";

async function requireMedicationPlan(userId: string) {
  return (await getEntitlements(userId)).medications;
}

const medicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dose: z.string().trim().max(100).optional(),
  frequency: z.string().trim().max(160).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireMedicationPlan(userId))) return Response.json({ error: "Medication tools require Pro", upgradeUrl: "/pricing" }, { status: 402 });
  await connectDB();
  const medications = await Medication.find({ userId }).sort({ status: 1, createdAt: -1 }).lean();
  const reportIds = [...new Set(medications.map((medication) => String(medication.reportId ?? "")).filter(Boolean))];
  const reports = reportIds.length > 0
    ? await Report.find({ _id: { $in: reportIds }, userId }).select("_id sourceLab reportDate createdAt").lean()
    : [];
  const reportById = new Map(reports.map((report) => [String(report._id), {
    _id: String(report._id),
    sourceLab: report.sourceLab ?? null,
    reportDate: report.reportDate ? new Date(report.reportDate).toISOString() : null,
    createdAt: new Date(report.createdAt).toISOString(),
  }]));
  return Response.json({
    medications: medications.map((medication) => ({
      ...medication,
      report: medication.reportId ? (reportById.get(String(medication.reportId)) ?? null) : null,
    })),
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireMedicationPlan(userId))) return Response.json({ error: "Medication tools require Pro", upgradeUrl: "/pricing" }, { status: 402 });
  const parsed = medicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid medication" }, { status: 400 });
  await connectDB();
  const medication = await Medication.create({ ...parsed.data, userId, source: "manual", status: "active" });
  return Response.json({ medication }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireMedicationPlan(userId))) return Response.json({ error: "Medication tools require Pro", upgradeUrl: "/pricing" }, { status: 402 });
  const input = z.object({ id: z.string().min(1), status: z.enum(["active", "stopped"]) }).safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Invalid update" }, { status: 400 });
  await connectDB();
  const medication = await Medication.findOneAndUpdate(
    { _id: input.data.id, userId },
    { $set: { status: input.data.status } },
    { new: true },
  );
  if (!medication) return Response.json({ error: "Medication not found" }, { status: 404 });
  return Response.json({ medication });
}
