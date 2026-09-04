import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  fileUrl: string;
  summary: string;
  ocr: string;
  labResults: mongoose.Types.ObjectId[];
  sourceLab?: string;
  sourceCountry?: string;
  reportDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    userId: { type: String, required: true, index: true },
    fileUrl: { type: String, required: true },
    summary: { type: String, required: true },
    ocr: { type: String, required: true },
    labResults: [{ type: Schema.Types.ObjectId, ref: 'LabResult' }],
    sourceLab: { type: String, trim: true, maxlength: 160 },
    sourceCountry: { type: String, trim: true, maxlength: 80 },
    reportDate: { type: Date, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Report = (mongoose.models.Report as mongoose.Model<IReport> | undefined)
  || mongoose.model<IReport>('Report', ReportSchema);
export default Report;
