import { auth } from "@clerk/nextjs/server";
import connectDB from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import EducationCard from "@/models/educationCard";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const entitlements = await getEntitlements(userId);
  if (!entitlements.education) return Response.json({ error: "Education cards require Pro", upgradeUrl: "/#pricing" }, { status: 402 });
  await connectDB();
  const cards = await EducationCard.find({ userId }).sort({ createdAt: -1 }).limit(60).lean();
  return Response.json({ cards });
}
