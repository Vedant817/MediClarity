import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import connectDB from "@/lib/db";
import Medication from "@/models/medication";
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
  if (!(await requireMedicationPlan(userId))) return Response.json({ error: "Medication tools require Pro", upgradeUrl: "/#pricing" }, { status: 402 });
  await connectDB();
  const medications = await Medication.find({ userId }).sort({ status: 1, createdAt: -1 }).lean();
  return Response.json({ medications });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireMedicationPlan(userId))) return Response.json({ error: "Medication tools require Pro", upgradeUrl: "/#pricing" }, { status: 402 });
  const parsed = medicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid medication" }, { status: 400 });
  await connectDB();
  const medication = await Medication.create({ ...parsed.data, userId, source: "manual", status: "active" });
  return Response.json({ medication }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireMedicationPlan(userId))) return Response.json({ error: "Medication tools require Pro", upgradeUrl: "/#pricing" }, { status: 402 });
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
