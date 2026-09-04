import mongoose, { Schema } from "mongoose";

interface IApiUsageWindow {
  apiKeyId: mongoose.Types.ObjectId;
  endpoint: string;
  windowStart: Date;
  count: number;
  expiresAt: Date;
}

const ApiUsageWindowSchema = new Schema<IApiUsageWindow>({
  apiKeyId: { type: Schema.Types.ObjectId, ref: "ApiKey", required: true },
  endpoint: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
});

ApiUsageWindowSchema.index({ apiKeyId: 1, endpoint: 1, windowStart: 1 }, { unique: true });
ApiUsageWindowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.ApiUsageWindow ||
  mongoose.model<IApiUsageWindow>("ApiUsageWindow", ApiUsageWindowSchema);
