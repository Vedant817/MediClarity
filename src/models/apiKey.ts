import mongoose, { Schema } from "mongoose";
import { API_LIMITS } from "@/config/product";

export interface IApiKey {
  userId: string;
  name: string;
  keyHash: string;
  prefix: string;
  quota: number;
  monthlyUsage: number;
  usageMonth: string;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    keyHash: { type: String, required: true, unique: true, index: true },
    prefix: { type: String, required: true },
    quota: { type: Number, default: API_LIMITS.defaultMonthlyQuota, min: 0 },
    monthlyUsage: { type: Number, default: 0, min: 0 },
    usageMonth: { type: String, required: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ApiKeySchema.index({ userId: 1, revokedAt: 1, createdAt: -1 });

export default mongoose.models.ApiKey || mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
