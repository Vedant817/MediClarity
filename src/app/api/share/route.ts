import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import connectDB from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import { createShareToken, writeAuditLog } from "@/lib/share";
import Report from "@/models/report";
import VaultShare from "@/models/vaultShare";
import LabResult from "@/models/labResult";
import { suggestOrgans } from "@/lib/anatomy/organ-keywords.ts";
import { refineOrgansWithLLM, resolveVisualizations } from "@/lib/anatomy/organ-llm.ts";

const createShareSchema = z.object({
  reportId: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createShareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid share request" }, { status: 400 });

  const entitlements = await getEntitlements(userId);
  if (!entitlements.share) {
    return Response.json({ error: "Sharing requires Pro", upgradeUrl: "/pricing" }, { status: 402 });
  }

  await connectDB();
  const report = await Report.findOne({ _id: parsed.data.reportId, userId }).select({ _id: 1 }).lean();
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const { token, tokenHash } = createShareToken();
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000);
  const share = await VaultShare.create({
    reportId: report._id,
    ownerId: userId,
    sharedWithEmail: parsed.data.email || undefined,
    tokenHash,
    expiresAt,
  });

  await writeAuditLog({
    actorId: userId,
    action: "share",
    resourceId: String(report._id),
    resourceType: "report",
    metadata: { shareId: String(share._id), expiresAt },
  });

  // Snapshot visualizations so viewers see exactly what the owner approved.
  // Best-effort: share creation must never fail because of it.
  try {
    const full = await Report.findOne({ _id: report._id, userId }).lean();
    if (full && (!full.visualizations || full.visualizations.length === 0) && entitlements.trends) {
      const labs = await LabResult.find({ reportId: full._id, userId })
        .select({ canonicalName: 1, test: 1, flag: 1 })
        .lean();
      const text = `${full.summary ?? ""}\n\n${full.ocr ?? ""}`;
      const { suggestions } = await resolveVisualizations({
        deterministic: suggestOrgans(
          labs.map((lab) => ({ canonicalName: lab.canonicalName, test: lab.test, flag: lab.flag })),
          text,
        ),
        refine: () => refineOrgansWithLLM(text),
      });
      if (suggestions.length > 0) {
        await Report.updateOne(
          { _id: full._id, userId },
          { $set: { visualizations: suggestions.map((s) => ({ ...s, computedAt: new Date() })) } },
        );
      }
    }
  } catch (error) {
    console.error("Share visualization snapshot failed", error instanceof Error ? error.message : error);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return Response.json({ url: `${baseUrl}/share/${token}`, expiresAt });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const shareId = new URL(request.url).searchParams.get("id");
  if (!shareId) return Response.json({ error: "Share id is required" }, { status: 400 });

  await connectDB();
  const share = await VaultShare.findOneAndUpdate(
    { _id: shareId, ownerId: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true },
  );
  if (!share) return Response.json({ error: "Share not found" }, { status: 404 });
  await writeAuditLog({ actorId: userId, action: "revoke", resourceId: shareId, resourceType: "share" });
  return Response.json({ revoked: true });
}
