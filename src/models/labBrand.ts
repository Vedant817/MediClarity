import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const LabBrandSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    organizationName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    logoUrl: { type: String, trim: true, maxlength: 2048 },
    accentColor: { type: String, required: true, default: "#0f766e", match: /^#[0-9a-fA-F]{6}$/ },
  },
  { timestamps: true },
);

export type LabBrandRecord = InferSchemaType<typeof LabBrandSchema>;

const LabBrand = (mongoose.models.LabBrand as Model<LabBrandRecord> | undefined)
  ?? mongoose.model<LabBrandRecord>("LabBrand", LabBrandSchema);

export default LabBrand;
