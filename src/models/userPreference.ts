import mongoose, { Schema } from "mongoose";

export const SUPPORTED_LOCALES = ["en", "hi", "pa", "bn", "ta", "te", "mr", "gu", "kn", "ml"] as const;
export const REGION_PROFILES = ["GLOBAL", "IN", "US", "EU", "GCC"] as const;

const UserPreferenceSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    locale: { type: String, enum: SUPPORTED_LOCALES, default: "en" },
    regionProfile: { type: String, enum: REGION_PROFILES, default: "GLOBAL" },
    dateFormat: { type: String, enum: ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"], default: "YYYY-MM-DD" },
  },
  { timestamps: true },
);

export default mongoose.models.UserPreference || mongoose.model("UserPreference", UserPreferenceSchema);
