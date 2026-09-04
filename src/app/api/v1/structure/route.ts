import { z } from "zod";
import { authenticateAndMeterApiKey } from "@/lib/api-keys";
import { labToFhirObservation } from "@/lib/fhir";
import { extractStructuredLabs, llmMessageText } from "@/lib/lab-extraction";
import { getLLM } from "@/lib/llm";
import { normalizeLabs } from "@/lib/labs";
import { runOcrFromImageUrl, runOcrFromPdfUrl } from "@/lib/ocr";
import { assertSafeDocumentUrl } from "@/lib/safe-url";
import connectDB from "@/lib/db";
import { recordLabUsage } from "@/lib/stripe";
import Subscription from "@/models/subscription";
import { createHash } from "node:crypto";

const requestSchema = z.object({
  documentUrl: z.string().url().max(2_000),
  sourceLab: z.string().trim().max(160).optional(),
  sourceCountry: z.string().trim().max(80).optional(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "reportDate must use YYYY-MM-DD").refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
    },
    "reportDate must be a real calendar date",
  ).optional(),
});

type OcrPage = { markdown?: string; text?: string };

export async function POST(request: Request) {
  const authorization = await authenticateAndMeterApiKey(request.headers.get("x-api-key"), "/api/v1/structure");
  if (!authorization.ok) return Response.json({ error: authorization.error }, { status: authorization.status });

  await connectDB();
  const subscription = await Subscription.findOne({
    userId: authorization.apiKey.userId,
    plan: "lab",
    status: { $in: ["active", "trialing"] },
  }).select({ stripeCustomerId: 1 }).lean<{ stripeCustomerId?: string }>();
  if (!subscription?.stripeCustomerId || !process.env.STRIPE_LAB_METER_EVENT_NAME) {
    return Response.json({ error: "Lab usage billing is not configured" }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A valid public documentUrl is required" }, { status: 400 });

  let url: URL;
  try {
    url = await assertSafeDocumentUrl(parsed.data.documentUrl);
  } catch (error) {
    console.warn("Lab Structure API rejected document URL", error instanceof Error ? error.message : error);
    return Response.json({ error: "documentUrl must resolve to a public HTTPS resource" }, { status: 400 });
  }

  try {
    const ocr = url.pathname.toLowerCase().endsWith(".pdf")
      ? await runOcrFromPdfUrl(url.toString())
      : await runOcrFromImageUrl(url.toString());
    const text = ((ocr.pages ?? []) as OcrPage[]).map((page) => page.markdown || page.text || "").join("\n\n").trim();
    if (!text) return Response.json({ error: "No text could be extracted from the document" }, { status: 422 });

    const extracted = await extractStructuredLabs(text, parsed.data);
    const labs = normalizeLabs(extracted, parsed.data.reportDate ? new Date(parsed.data.reportDate) : new Date());
    const summaryMessage = await getLLM("chat").invoke(`Summarize the following lab report in plain language. Use only facts in the text, never diagnose, and end with "For information only, not medical advice."\n\n${text.slice(0, 120_000)}`);

    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 128);
    const eventSeed = idempotencyKey || `${authorization.apiKey._id}:${authorization.apiKey.usageMonth}:${authorization.apiKey.monthlyUsage}`;
    const reportEventId = `lab_${createHash("sha256").update(eventSeed).digest("hex")}`;
    await recordLabUsage(subscription.stripeCustomerId, reportEventId);

    return Response.json({
      labs,
      fhir: labs.map(labToFhirObservation),
      summary: llmMessageText(summaryMessage).trim(),
      provenance: {
        normalizedAt: new Date().toISOString(),
        normalizationVersion: labs[0]?.normalization.version ?? "2026-08-31",
        warning: "Candidate name and LOINC mappings require validation before clinical use.",
      },
      usageEventId: reportEventId,
    });
  } catch (error) {
    console.error("Lab Structure API failed", error);
    return Response.json({ error: "Document processing failed" }, { status: 422 });
  }
}
