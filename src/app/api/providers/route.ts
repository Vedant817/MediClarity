import { auth } from "@clerk/nextjs/server";
import connectDB from "@/lib/db";
import Provider from "@/models/provider";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const providers = await Provider.find({ acceptingNewPatients: true })
    .select({ _id: 0, id: 1, name: 1, specialty: 1, hospital: 1, languages: 1 })
    .sort({ name: 1 })
    .lean();
  return Response.json({ providers });
}
