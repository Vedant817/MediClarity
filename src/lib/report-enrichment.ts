import { z } from "zod";
import { getLLM, llmContentToText } from "@/lib/llm";

export const extractedMedicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dose: z.string().trim().max(100).optional(),
  frequency: z.string().trim().max(160).optional(),
});
export const extractedMedicationsSchema = z.array(extractedMedicationSchema).max(50);

export const educationCardInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(600),
});
export const educationCardsInputSchema = z.array(educationCardInputSchema).max(3);

const enrichmentSchema = z.object({
  medications: extractedMedicationsSchema,
  education: educationCardsInputSchema,
});

function parseObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Enrichment response did not contain JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export async function extractReportEnrichment(text: string) {
  const prompt = `Use only the report text below. Return JSON only:
{"medications":[{"name":"printed medicine name","dose":"printed dose or omit","frequency":"printed frequency or omit"}],"education":[{"title":"simple educational topic","summary":"one sentence grounded in a report finding"}]}
Rules: Never invent a medicine, diagnosis, dose, or finding. Return at most 3 education cards. Education is general information only, not advice. If nothing is present, use empty arrays.
REPORT:\n${text}`;
  try {
    const response = await getLLM("extract").invoke(prompt);
    return enrichmentSchema.parse(parseObject(llmContentToText(response.content)));
  } catch (error) {
    console.warn("Report enrichment validation failed", error instanceof Error ? error.message : error);
    return { medications: [], education: [] };
  }
}
