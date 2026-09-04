import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import connectDB from "@/lib/db";
import UserPreference, { REGION_PROFILES, SUPPORTED_LOCALES } from "@/models/userPreference";

const preferenceSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  regionProfile: z.enum(REGION_PROFILES),
  dateFormat: z.enum(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const preferences = await UserPreference.findOne({ userId }).lean();
  return Response.json({ preferences: preferences ?? { locale: "en", regionProfile: "GLOBAL", dateFormat: "YYYY-MM-DD" } });
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid preferences" }, { status: 400 });
  await connectDB();
  const preferences = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: parsed.data },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return Response.json({ preferences });
}
