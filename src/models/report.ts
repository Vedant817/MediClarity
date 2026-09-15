import mongoose, { Document, Schema } from 'mongoose';

export interface IReportVisualization {
  organId: string;
  subRegion?: string | null;
  relatedTo?: string | null;
  confidence: number;
  evidence: string[];
  laterality: string;
  computedAt: Date;
}

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
  visualizations: IReportVisualization[];
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
    visualizations: {
      type: [
        {
          organId: { type: String, required: true },
          subRegion: { type: String, default: null },
          relatedTo: { type: String, default: null },
          confidence: { type: Number, required: true, min: 0, max: 1 },
          evidence: { type: [String], default: [] },
          laterality: { type: String, default: "unknown" },
          computedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Report = (mongoose.models.Report as mongoose.Model<IReport> | undefined)
  || mongoose.model<IReport>('Report', ReportSchema);
export default Report;
