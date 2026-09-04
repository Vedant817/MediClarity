import mongoose, { Document, Schema } from "mongoose";

export interface ILabResult extends Document {
  userId: string;
  reportId: mongoose.Types.ObjectId;
  test: string;
  canonicalName: string;
  value: number;
  unit?: string;
  refMin?: number;
  refMax?: number;
  flag: "normal" | "high" | "low" | "unknown";
  date: Date;
  source: string;
  sourceLab?: string;
  sourceCountry?: string;
  loinc?: string;
  original: { test: string; value: number; unit?: string; refMin?: number; refMax?: number };
  referenceRangeSource: "lab_provided" | "not_provided";
  normalization: {
    version: string;
    aliasMatched: boolean;
    unitConverted: boolean;
    conversion?: string;
    loincMapping: "candidate_alias_map" | "none";
  };
}

const LabResultSchema = new Schema<ILabResult>(
  {
    userId: { type: String, required: true, index: true },
    reportId: { type: Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    test: { type: String, required: true },
    canonicalName: { type: String, required: true, index: true },
    value: { type: Number, required: true },
    unit: String,
    refMin: Number,
    refMax: Number,
    flag: { type: String, enum: ["normal", "high", "low", "unknown"], required: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    source: { type: String, required: true, default: "ocr" },
    sourceLab: String,
    sourceCountry: String,
    loinc: String,
    original: {
      test: { type: String, required: true },
      value: { type: Number, required: true },
      unit: String,
      refMin: Number,
      refMax: Number,
    },
    referenceRangeSource: {
      type: String,
      enum: ["lab_provided", "not_provided"],
      required: true,
    },
    normalization: {
      version: { type: String, required: true },
      aliasMatched: { type: Boolean, required: true },
      unitConverted: { type: Boolean, required: true },
      conversion: String,
      loincMapping: { type: String, enum: ["candidate_alias_map", "none"], required: true },
    },
  },
  { timestamps: true },
);

LabResultSchema.index({ userId: 1, canonicalName: 1, date: -1 });
LabResultSchema.index({ reportId: 1, canonicalName: 1 });

const LabResult = (mongoose.models.LabResult as mongoose.Model<ILabResult> | undefined)
  || mongoose.model<ILabResult>("LabResult", LabResultSchema);
export default LabResult;
