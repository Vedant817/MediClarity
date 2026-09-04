import { getLLM } from "@/lib/llm";
import { llmMessageText } from "@/lib/lab-extraction";

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

export async function summarizeReport(text: string): Promise<string> {
  const message = await getLLM("chat").invoke(patientFriendlyPrompt(text));
  const summary = llmMessageText(message).trim();
  if (!summary) throw new Error("The model returned an empty summary");
  return summary;
}
