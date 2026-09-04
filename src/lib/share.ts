import { createHash, createHmac, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import AuditLog, { AuditAction } from "@/models/auditLog";
import LabResult from "@/models/labResult";
import LabBrand from "@/models/labBrand";
import Report from "@/models/report";
import VaultShare, { type IVaultShare } from "@/models/vaultShare";

export function createShareToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashShareToken(token) };
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashAuditIp(ip: string | null): string | undefined {
  if (!ip) return undefined;
  const key = process.env.AUDIT_HASH_SECRET;
  if (!key) return undefined;
  return createHmac("sha256", key).update(ip).digest("hex");
}

export async function readPublicShare(token: string) {
  if (!token || token.length > 128) return null;
  await connectDB();

  const share = await VaultShare.findOne({
    tokenHash: hashShareToken(token),
    expiresAt: { $gt: new Date() },
    revokedAt: null,
  }).lean<IVaultShare & { _id: Types.ObjectId }>().exec();
  if (!share) return null;

  const [report, labs, brand] = await Promise.all([
    Report.findById(share.reportId).select({ userId: 0, ocr: 0 }).lean(),
    LabResult.find({ reportId: share.reportId }).sort({ canonicalName: 1 }).lean(),
    LabBrand.findOne({ userId: share.ownerId }).select({ organizationName: 1, logoUrl: 1, accentColor: 1 }).lean(),
  ]);
  if (!report) return null;
  return { share, report, labs, brand };
}

export async function writeAuditLog(input: {
  actorId?: string;
  action: AuditAction;
  resourceId: string;
  resourceType: "report" | "lab" | "share";
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await connectDB();
  await AuditLog.create({
    actorId: input.actorId,
    action: input.action,
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    ipHash: hashAuditIp(input.ip ?? null),
    userAgent: input.userAgent?.slice(0, 512),
    metadata: input.metadata ?? {},
  });
}
