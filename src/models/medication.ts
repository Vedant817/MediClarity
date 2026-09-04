import mongoose, { Schema } from "mongoose";

export interface IMedication {
  userId: string;
  reportId?: mongoose.Types.ObjectId;
  name: string;
  dose?: string;
  frequency?: string;
  startDate?: Date;
  endDate?: Date;
  status: "active" | "stopped";
  source: "ocr" | "manual";
  createdAt: Date;
  updatedAt: Date;
}

const MedicationSchema = new Schema<IMedication>(
  {
    userId: { type: String, required: true, index: true },
    reportId: { type: Schema.Types.ObjectId, ref: "Report", index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    dose: { type: String, trim: true, maxlength: 100 },
    frequency: { type: String, trim: true, maxlength: 160 },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ["active", "stopped"], default: "active", index: true },
    source: { type: String, enum: ["ocr", "manual"], required: true },
  },
  { timestamps: true },
);

MedicationSchema.index({ userId: 1, name: 1, status: 1 });

export default mongoose.models.Medication || mongoose.model<IMedication>("Medication", MedicationSchema);
