import mongoose, { Schema } from "mongoose";

export interface IEducationCard {
  userId: string;
  reportId: mongoose.Types.ObjectId;
  title: string;
  summary: string;
  locale: string;
  createdAt: Date;
}

const EducationCardSchema = new Schema<IEducationCard>(
  {
    userId: { type: String, required: true, index: true },
    reportId: { type: Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 600 },
    locale: { type: String, required: true, default: "en" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.models.EducationCard ||
  mongoose.model<IEducationCard>("EducationCard", EducationCardSchema);
