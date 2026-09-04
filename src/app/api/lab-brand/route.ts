import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import connectDB from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import { assertSafeDocumentUrl } from "@/lib/safe-url";
import LabBrand from "@/models/labBrand";

const logoUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && hostname !== "localhost"
      && hostname !== "127.0.0.1"
      && hostname !== "::1"
      && !hostname.endsWith(".local");
  } catch {
    return false;
  }
}, "Logo must be a public HTTPS URL");

const brandSchema = z.object({
  organizationName: z.string().trim().min(2).max(80),
  logoUrl: logoUrlSchema.optional().default(""),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color"),
});

async function requireLabPlan(userId: string) {
  const entitlements = await getEntitlements(userId);
  return entitlements.plan === "lab";
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireLabPlan(userId))) return Response.json({ error: "Lab API plan required" }, { status: 402 });

  await connectDB();
  const brand = await LabBrand.findOne({ userId })
    .select({ organizationName: 1, logoUrl: 1, accentColor: 1 })
    .lean();
  return Response.json({ brand });
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireLabPlan(userId))) return Response.json({ error: "Lab API plan required" }, { status: 402 });

  const parsed = brandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid brand configuration" }, { status: 400 });
  }
  if (parsed.data.logoUrl) {
    try {
      await assertSafeDocumentUrl(parsed.data.logoUrl);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Logo must be a public HTTPS URL" }, { status: 400 });
    }
  }

  await connectDB();
  const brand = await LabBrand.findOneAndUpdate(
    { userId },
    { $set: parsed.data },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).select({ organizationName: 1, logoUrl: 1, accentColor: 1 });
  return Response.json({ brand });
}
