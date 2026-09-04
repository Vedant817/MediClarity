import connectDB from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import Report from "@/models/report";
import ReportQuota from "@/models/reportQuota";

function currentUtcMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

function utcMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type ReportQuotaReservation = {
  userId: string;
  month: string;
  reserved: boolean;
  used: number;
  limit: number | null;
  entitlements: Awaited<ReturnType<typeof getEntitlements>>;
};

/**
 * Reserve a free-plan report slot before performing paid OCR/model work.
 * The counter update is atomic, so concurrent ingests cannot all pass a
 * count-then-create check. Existing Report rows are reconciled into the
 * counter before each reservation for compatibility with pre-counter data.
 */
export async function reserveReportQuota(userId: string): Promise<ReportQuotaReservation | null> {
  const entitlements = await getEntitlements(userId);
  if (entitlements.maxReportsPerMonth === null) {
    return { userId, month: currentUtcMonth(), reserved: false, used: 0, limit: null, entitlements };
  }

  await connectDB();
  const now = new Date();
  const month = currentUtcMonth(now);
  const existingReports = await Report.countDocuments({ userId, createdAt: { $gte: utcMonthStart(now) } });

  // A concurrent first reservation can win the unique upsert. Retrying reads
  // that winner and applies the same atomic limit predicate.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await ReportQuota.updateOne(
        { userId, month },
        { $max: { used: existingReports }, $setOnInsert: { userId, month } },
        { upsert: true },
      );
      const counter = await ReportQuota.findOneAndUpdate(
        { userId, month, used: { $lt: entitlements.maxReportsPerMonth } },
        { $inc: { used: 1 } },
        { new: true },
      ).lean<{ used: number }>();
      if (!counter) return null;
      return {
        userId,
        month,
        reserved: true,
        used: counter.used,
        limit: entitlements.maxReportsPerMonth,
        entitlements,
      };
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000) || attempt === 1) {
        throw error;
      }
    }
  }
  return null;
}

export async function releaseReportQuota(reservation: ReportQuotaReservation | null): Promise<void> {
  if (!reservation?.reserved) return;
  await connectDB();
  await ReportQuota.updateOne(
    { userId: reservation.userId, month: reservation.month, used: { $gt: 0 } },
    { $inc: { used: -1 } },
  );
}

export async function getReportQuota(userId: string) {
  const entitlements = await getEntitlements(userId);
  if (entitlements.maxReportsPerMonth === null) {
    return { allowed: true, used: 0, limit: null, entitlements };
  }

  await connectDB();
  const now = new Date();
  const month = currentUtcMonth(now);
  const [reportCount, counter] = await Promise.all([
    Report.countDocuments({ userId, createdAt: { $gte: utcMonthStart(now) } }),
    ReportQuota.findOne({ userId, month }).select({ used: 1 }).lean<{ used?: number }>(),
  ]);
  const used = Math.max(reportCount, counter?.used ?? 0);
  return {
    allowed: used < entitlements.maxReportsPerMonth,
    used,
    limit: entitlements.maxReportsPerMonth,
    entitlements,
  };
}

export function quotaExceededResponse(quota: { used: number; limit: number | null }) {
  return Response.json(
    {
      error: "Monthly report limit reached",
      code: "REPORT_LIMIT_REACHED",
      used: quota.used,
      limit: quota.limit,
      upgradeUrl: "/#pricing",
    },
    { status: 402 },
  );
}
