import { createHash, randomBytes } from "node:crypto";
import connectDB from "@/lib/db";
import ApiKey from "@/models/apiKey";
import ApiUsageWindow from "@/models/apiUsageWindow";
import { API_LIMITS } from "@/config/product";

function keyHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function generateApiKey(): { rawKey: string; hash: string; prefix: string } {
  const rawKey = `mc_live_${randomBytes(32).toString("base64url")}`;
  return { rawKey, hash: keyHash(rawKey), prefix: rawKey.slice(0, 16) };
}

export async function authenticateAndMeterApiKey(rawKey: string | null, endpoint: string) {
  if (!rawKey || rawKey.length > 160 || !rawKey.startsWith("mc_live_")) {
    return { ok: false as const, status: 401, error: "Invalid API key" };
  }

  await connectDB();
  let apiKey = await ApiKey.findOne({ keyHash: keyHash(rawKey), revokedAt: null });
  if (!apiKey) return { ok: false as const, status: 401, error: "Invalid API key" };

  const month = currentMonth();
  if (apiKey.usageMonth !== month) {
    apiKey.monthlyUsage = 0;
    apiKey.usageMonth = month;
    await apiKey.save();
  }

  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const window = await ApiUsageWindow.findOneAndUpdate(
    { apiKeyId: apiKey._id, endpoint, windowStart },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(windowStart.getTime() + API_LIMITS.usageWindowRetentionDays * 24 * 60 * 60 * 1000) },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  if (window.count > API_LIMITS.requestsPerMinute) {
    return { ok: false as const, status: 429, error: "Rate limit exceeded" };
  }

  apiKey = await ApiKey.findOneAndUpdate(
    { _id: apiKey._id, monthlyUsage: { $lt: apiKey.quota } },
    { $inc: { monthlyUsage: 1 }, $set: { lastUsedAt: new Date() } },
    { new: true },
  );
  if (!apiKey) return { ok: false as const, status: 429, error: "Monthly quota exceeded" };

  return { ok: true as const, apiKey };
}
