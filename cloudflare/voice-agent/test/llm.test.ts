import { describe, expect, it, vi } from "vitest";
import { generateVoiceAnswer } from "../src/workers-ai-llm";

describe("Workers AI voice generation", () => {
  it("returns the direct non-streaming response exactly once", async () => {
    const run = vi.fn(async (_model: string, _input: Record<string, unknown>) => ({
      response: "Your health record is currently empty.",
    }));
    const answer = await generateVoiceAnswer(
      { run } as unknown as Ai,
      "Use the supplied record only.",
      [{ role: "assistant", content: "How can I help?" }],
      "What is in my record?",
      new AbortController().signal,
    );

    expect(answer).toBe("Your health record is currently empty.");
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      max_tokens: 300,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Use the supplied record only." },
        { role: "assistant", content: "How can I help?" },
        { role: "user", content: "What is in my record?" },
      ],
    });
  });
});
