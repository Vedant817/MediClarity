import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { cloudinary } from "@/lib/cloudinary";
import connectDB from "@/lib/db";
import { extractStructuredLabs } from "@/lib/lab-extraction";
import { normalizeLabs } from "@/lib/labs";
import { runOcrFromImageUrl, runOcrFromPdfUrl } from "@/lib/ocr";
import { extractReportEnrichment } from "@/lib/report-enrichment";
import {
  releaseReportQuota,
  reserveReportQuota,
  type ReportQuotaReservation,
} from "@/lib/report-quota";
import { summarizeReport } from "@/lib/report-summary";
import {
  MAX_UPLOAD_BODY_BYTES,
  safeUploadFileName,
  validateReportFile,
} from "@/lib/upload-security";
import EducationCard from "@/models/educationCard";
import LabResult from "@/models/labResult";
import Medication from "@/models/medication";
import Report from "@/models/report";

export const runtime = "nodejs";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});

const metadataSchema = z.object({
  sourceLab: z.string().trim().max(160).optional(),
  sourceCountry: z.string().trim().max(80).optional(),
  reportDate: isoDateSchema.optional(),
});

type CloudinaryUpload = {
  secure_url: string;
  public_id: string;
  resource_type: string;
};

type OcrPage = { markdown?: string; text?: string };

function optionalFormString(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

async function uploadReport(file: File, bytes: Uint8Array): Promise<CloudinaryUpload> {
  const dataUri = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    invalidate: true,
    resource_type: "auto",
    filename_override: safeUploadFileName(file.name),
    folder: "med_insight",
    use_filename: true,
  });
  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
  };
}

async function destroyUpload(upload: CloudinaryUpload | null): Promise<void> {
  if (!upload) return;
  await cloudinary.uploader.destroy(upload.public_id, {
    invalidate: true,
    resource_type: upload.resource_type as "image" | "raw" | "video",
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BODY_BYTES) {
    return Response.json({ error: "Report upload is limited to 15 MB" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "A multipart report upload is required" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No report file was provided" }, { status: 400 });
  }

  const metadata = metadataSchema.safeParse({
    sourceLab: optionalFormString(formData, "sourceLab"),
    sourceCountry: optionalFormString(formData, "sourceCountry"),
    reportDate: optionalFormString(formData, "reportDate"),
  });
  if (!metadata.success) {
    return Response.json({ error: "Invalid report metadata", details: metadata.error.flatten() }, { status: 400 });
  }

  let bytes: Uint8Array;
  try {
    bytes = await validateReportFile(file);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid report file" },
      { status: 400 },
    );
  }

  let reservation: ReportQuotaReservation | null = null;
  let upload: CloudinaryUpload | null = null;
  let reportId: string | null = null;
  let committed = false;

  try {
    reservation = await reserveReportQuota(userId);
    if (!reservation) {
      return Response.json({
        error: "Monthly report limit reached",
        code: "REPORT_LIMIT_REACHED",
        upgradeUrl: "/#pricing",
      }, { status: 402 });
    }

    upload = await uploadReport(file, bytes);
    const ocr = file.type === "application/pdf"
      ? await runOcrFromPdfUrl(upload.secure_url)
      : await runOcrFromImageUrl(upload.secure_url);
    const fullText = ((ocr.pages ?? []) as OcrPage[])
      .map((page) => page.markdown || page.text || "")
      .join("\n\n")
      .trim();
    if (!fullText) {
      return Response.json({ error: "No text could be extracted from the report" }, { status: 422 });
    }

    const analysisText = fullText.slice(0, 200_000);
    const enrichmentPromise = reservation.entitlements.medications || reservation.entitlements.education
      ? extractReportEnrichment(analysisText)
      : Promise.resolve({ medications: [], education: [] });
    const [summary, extractedLabs, enrichment] = await Promise.all([
      summarizeReport(analysisText),
      extractStructuredLabs(analysisText, metadata.data),
      enrichmentPromise,
    ]);

    await connectDB();
    const reportDate = metadata.data.reportDate
      ? new Date(`${metadata.data.reportDate}T00:00:00.000Z`)
      : undefined;
    const report = await Report.create({
      userId,
      fileUrl: upload.secure_url,
      summary,
      ocr: fullText.slice(0, 500_000),
      labResults: [],
      sourceLab: metadata.data.sourceLab,
      sourceCountry: metadata.data.sourceCountry,
      reportDate,
    });
    reportId = String(report._id);

    const normalizedLabs = normalizeLabs(extractedLabs, reportDate ?? report.createdAt);
    const savedLabs = normalizedLabs.length
      ? await LabResult.insertMany(normalizedLabs.map((lab) => ({ ...lab, userId, reportId: report._id })))
      : [];
    const [savedMedications, savedEducation] = await Promise.all([
      reservation.entitlements.medications && enrichment.medications.length
        ? Medication.insertMany(enrichment.medications.map((medication) => ({
          ...medication,
          userId,
          reportId: report._id,
          status: "active",
          source: "ocr",
        })))
        : [],
      reservation.entitlements.education && enrichment.education.length
        ? EducationCard.insertMany(enrichment.education.map((card) => ({
          ...card,
          userId,
          reportId: report._id,
          locale: "en",
        })))
        : [],
    ]);

    if (savedLabs.length) {
      report.labResults = savedLabs.map((lab) => lab._id);
      await report.save();
    }

    committed = true;
    return Response.json({
      message: "Report processed and saved",
      report: {
        id: String(report._id),
        fileUrl: report.fileUrl,
        summary: report.summary,
        ocr: report.ocr,
      },
      labResultCount: savedLabs.length,
      medicationCount: savedMedications.length,
      educationCount: savedEducation.length,
    }, { status: 201 });
  } catch (error) {
    console.error("Server-owned report ingest failed", error);
    return Response.json({ error: "Report processing failed" }, { status: 500 });
  } finally {
    if (!committed) {
      if (reportId) {
        await Promise.allSettled([
          LabResult.deleteMany({ reportId, userId }),
          Medication.deleteMany({ reportId, userId }),
          EducationCard.deleteMany({ reportId, userId }),
          Report.deleteOne({ _id: reportId, userId }),
        ]);
      }
      await Promise.allSettled([
        destroyUpload(upload),
        releaseReportQuota(reservation),
      ]);
    }
  }
}
