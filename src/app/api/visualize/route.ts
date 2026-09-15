import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Report from "@/models/report";
import LabResult from "@/models/labResult";
import { getEntitlements } from "@/lib/entitlements";
import { suggestOrgans } from "@/lib/anatomy/organ-keywords.ts";
import { refineOrgansWithLLM, resolveVisualizations } from "@/lib/anatomy/organ-llm.ts";
import { VISUALIZATION_COPY } from "@/lib/anatomy/types.ts";
import { writeAuditLog } from "@/lib/share";

export const runtime = "nodejs";

const requestSchema = z.object({ reportId: z.string().trim().min(1).max(64) });

/**
 * Organ Intelligence Layer endpoint. Maps a saved report to up to three
 * educational organ visualizations (deterministic first, constrained LLM
 * only when evidence is thin) and caches the result on the report so
 * repeat views cost nothing.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await getEntitlements(userId)).trends) {
    return NextResponse.json({ error: "3D explanations require Pro", upgradeUrl: "/pricing" }, { status: 402 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !mongoose.Types.ObjectId.isValid(parsed.data.reportId)) {
    return NextResponse.json({ error: "A valid reportId is required" }, { status: 400 });
  }

  await connectDB();
  const report = await Report.findOne({ _id: parsed.data.reportId, userId }).lean();
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  if (report.visualizations && report.visualizations.length > 0) {
    return NextResponse.json({
      visualizations: report.visualizations,
      cached: true,
      usedLlm: false,
      disclaimer: VISUALIZATION_COPY.disclaimer,
    });
  }

  const labs = await LabResult.find({ reportId: report._id, userId })
    .select({ canonicalName: 1, test: 1, flag: 1 })
    .lean();
  const text = `${report.summary ?? ""}\n\n${report.ocr ?? ""}`;
  const deterministic = suggestOrgans(
    labs.map((lab) => ({ canonicalName: lab.canonicalName, test: lab.test, flag: lab.flag })),
    text,
  );
  const { suggestions, usedLlm } = await resolveVisualizations({
    deterministic,
    refine: () => refineOrgansWithLLM(text),
  });

  const cached = suggestions.map((suggestion) => ({ ...suggestion, computedAt: new Date() }));
  await Report.updateOne({ _id: report._id, userId }, { $set: { visualizations: cached } });

  // Audit must never break visualization: failure is logged, not thrown.
  try {
    await writeAuditLog({
      actorId: userId,
      action: "visualize",
      resourceId: String(report._id),
      resourceType: "report",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        organs: suggestions.map((suggestion) => suggestion.organId),
        usedLlm,
      },
    });
  } catch (error) {
    console.error("Visualize audit failed", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    visualizations: cached,
    cached: false,
    usedLlm,
    disclaimer: VISUALIZATION_COPY.disclaimer,
  });
}
