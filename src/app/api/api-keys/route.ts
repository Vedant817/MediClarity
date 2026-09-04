import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { generateApiKey } from "@/lib/api-keys";
import connectDB from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import ApiKey from "@/models/apiKey";
import { API_LIMITS } from "@/config/product";

const nameSchema = z.object({ name: z.string().trim().min(1).max(80) });

async function requireApiPlan(userId: string) {
  const entitlements = await getEntitlements(userId);
  return entitlements.api;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireApiPlan(userId))) return Response.json({ error: "Lab API plan required" }, { status: 402 });
  await connectDB();
  const keys = await ApiKey.find({ userId, revokedAt: null })
    .select({ name: 1, prefix: 1, quota: 1, monthlyUsage: 1, usageMonth: 1, lastUsedAt: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .lean();
  return Response.json({ keys });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireApiPlan(userId))) return Response.json({ error: "Lab API plan required" }, { status: 402 });
  const parsed = nameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A key name is required" }, { status: 400 });

  await connectDB();
  const activeCount = await ApiKey.countDocuments({ userId, revokedAt: null });
  if (activeCount >= API_LIMITS.maxActiveKeysPerAccount) return Response.json({ error: "Revoke an existing key before creating another" }, { status: 409 });

  const generated = generateApiKey();
  const key = await ApiKey.create({
    userId,
    name: parsed.data.name,
    keyHash: generated.hash,
    prefix: generated.prefix,
    usageMonth: new Date().toISOString().slice(0, 7),
  });
  return Response.json({ id: key._id, key: generated.rawKey, prefix: generated.prefix }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Key id is required" }, { status: 400 });
  await connectDB();
  const key = await ApiKey.findOneAndUpdate({ _id: id, userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (!key) return Response.json({ error: "Key not found" }, { status: 404 });
  return Response.json({ revoked: true });
}
