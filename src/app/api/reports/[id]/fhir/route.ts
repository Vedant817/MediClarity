import { auth } from "@clerk/nextjs/server";
import connectDB from "@/lib/db";
import { labToFhirObservation } from "@/lib/fhir";
import LabResult from "@/models/labResult";
import Report from "@/models/report";
import type { NormalizedLab } from "@/lib/labs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await connectDB();
  const report = await Report.findOne({ _id: id, userId }).select({ _id: 1 }).lean();
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  const labs = await LabResult.find({ reportId: id, userId }).lean<NormalizedLab[]>();
  return Response.json({
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: labs.map((lab) => ({ resource: labToFhirObservation(lab) })),
    warning: "Candidate mappings require validation before clinical use.",
  });
}
