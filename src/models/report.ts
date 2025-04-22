import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  fileUrl: { type: String, required: true },
  summary: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Report = mongoose.models.Report || mongoose.model("Report", ReportSchema);
export default Report;