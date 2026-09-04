import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ReportQuotaSchema = new Schema(
  {
    userId: { type: String, required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    used: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

ReportQuotaSchema.index({ userId: 1, month: 1 }, { unique: true });

export type ReportQuotaRecord = InferSchemaType<typeof ReportQuotaSchema>;

const ReportQuota = (mongoose.models.ReportQuota as Model<ReportQuotaRecord> | undefined)
  ?? mongoose.model<ReportQuotaRecord>("ReportQuota", ReportQuotaSchema);

export default ReportQuota;
