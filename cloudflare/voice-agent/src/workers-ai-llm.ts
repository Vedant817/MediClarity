import { buildTranscriptRepairPrompt, extractRepairJson, recoverReportPrecautionRequest } from "./transcript-repair";

export type VoiceHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function repairSpokenTranscript(
  ai: Ai,
  transcript: string,
  keyterms: string[],
  signal: AbortSignal,
): Promise<string> {
  const heuristic = recoverReportPrecautionRequest(transcript);
  if (heuristic) return heuristic;
  try {
    const result = await ai.run(
      "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
      {
        messages: [
          { role: "system", content: buildTranscriptRepairPrompt(keyterms) },
          { role: "user", content: transcript.slice(0, 1_000) },
        ],
        max_tokens: 160,
        temperature: 0,
      },
      { signal: AbortSignal.any([signal, AbortSignal.timeout(6_000)]) },
    );
    const raw = typeof result.response === "string" ? result.response : "";
    const parsed = extractRepairJson(raw);
    if (parsed?.confident && parsed.cleaned) return parsed.cleaned;
    return recoverReportPrecautionRequest(parsed?.cleaned ?? "") ?? transcript;
  } catch {
    return transcript;
  }
}

export async function generateVoiceAnswer(
  ai: Ai,
  system: string,
  history: VoiceHistoryMessage[],
  transcript: string,
  signal: AbortSignal,
) {
  const result = await ai.run(
    "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
    {
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: transcript },
      ],
      max_tokens: 700,
      temperature: 0.2,
    },
    { signal },
  );
  return typeof result.response === "string" ? result.response.trim() : "";
}
