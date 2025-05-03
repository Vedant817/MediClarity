import mongoose, { Document, Schema } from 'mongoose';

interface IReport extends Document {
  userId: string;
  fileUrl: string;
  summary: string;
  ocr: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    userId: { type: String, required: true, index: true },
    fileUrl: { type: String, required: true },
    summary: { type: String, required: true },
    ocr: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Report = mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);
export default Report;