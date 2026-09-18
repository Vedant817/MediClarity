export type VoiceHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

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
      max_tokens: 300,
      temperature: 0.2,
    },
    { signal },
  );
  return typeof result.response === "string" ? result.response.trim() : "";
}
