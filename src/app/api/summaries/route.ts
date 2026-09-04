import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractStructuredLabs, llmMessageText } from "@/lib/lab-extraction";
import { getLLM } from "@/lib/llm";
import { getEntitlements } from "@/lib/entitlements";
import { extractReportEnrichment } from "@/lib/report-enrichment";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const metadataSchema = z.object({
  sourceLab: z.string().trim().max(160).optional(),
  sourceCountry: z.string().trim().max(80).optional(),
  reportDate: isoDateSchema.optional(),
}).optional();
const requestSchema = z.object({ text: z.string().trim().min(1).max(200_000), metadata: metadataSchema });

const patientFriendlyPrompt = (text: string) => `
You are a health-information assistant, not a doctor. Explain the supplied medical report in simple language. Do not diagnose, prescribe, or invent facts. When the report does not contain an answer, say so plainly.

Structure the response as:
1. What this report was for
2. Main findings
3. What the findings may mean and appropriate questions for a clinician
4. Key takeaways

End exactly with: "For information only, not medical advice. Discuss results and reference ranges with a qualified clinician."

Report content:
"""${text}"""
`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "A non-empty report text is required" }, { status: 400 });
    }

    const { text, metadata } = parsed.data;
    const entitlements = await getEntitlements(userId);
    const [summaryMessage, labs, enrichment] = await Promise.all([
      getLLM("chat").invoke(patientFriendlyPrompt(text)),
      extractStructuredLabs(text, metadata),
      entitlements.medications || entitlements.education
        ? extractReportEnrichment(text)
        : Promise.resolve({ medications: [], education: [] }),
    ]);
    const summary = llmMessageText(summaryMessage).trim();
    if (!summary) throw new Error("The model returned an empty summary");

    return NextResponse.json({ summary, labs, ...enrichment });
  } catch (err) {
    console.error("Summary Error:", err);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
