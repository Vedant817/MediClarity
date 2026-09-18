import { describe, expect, it, vi } from "vitest";
import { generateVoiceAnswer, repairSpokenTranscript } from "../src/workers-ai-llm";

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
      max_tokens: 700,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Use the supplied record only." },
        { role: "assistant", content: "How can I help?" },
        { role: "user", content: "What is in my record?" },
      ],
    });
  });

  it("repairs a garbled reports-and-precautions transcript without calling the model", async () => {
    const run = vi.fn();
    const cleaned = await repairSpokenTranscript(
      { run } as unknown as Ai,
      "Three to five or four motrophs. last three or four reports. tell me the precautions I should take?",
      ["HbA1c", "Metformin XR"],
      new AbortController().signal,
    );
    expect(cleaned).toBe("Based on my last three or four reports, what precautions should I take?");
    expect(run).not.toHaveBeenCalled();
  });

  it("uses a confident model repair when the heuristic does not match", async () => {
    const run = vi.fn(async () => ({
      response: '{"cleaned":"What was my latest HbA1c?","confident":true}',
    }));
    const cleaned = await repairSpokenTranscript(
      { run } as unknown as Ai,
      "what was my latest hemo a one c",
      ["HbA1c"],
      new AbortController().signal,
    );
    expect(cleaned).toBe("What was my latest HbA1c?");
    expect(run).toHaveBeenCalledOnce();
  });
});

