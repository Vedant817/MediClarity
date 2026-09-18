import { describe, expect, it, vi } from "vitest";
import { greetingFor, isVoiceLocale, whisperLanguage } from "../src/languages";
import { cleanVoiceTranscript, pcm16Rms } from "../src/transcript-filter";
import { pcm16ToWav, WorkersAIWhisperTranscriber } from "../src/workers-ai-stt";

describe("multilingual speech safety", () => {
  it("recognizes only configured voice locales and localizes greetings", () => {
    expect(isVoiceLocale("pa-IN")).toBe(true);
    expect(isVoiceLocale("es-ES")).toBe(false);
    expect(greetingFor("hi-IN", "Asha")).toContain("नमस्ते Asha");
    expect(greetingFor("pa-IN")).toContain("ਸਤ ਸ੍ਰੀ ਅਕਾਲ");
    expect(whisperLanguage("ta-IN")).toBe("ta");
  });

  it("wraps microphone PCM in a valid mono 16 kHz WAV for Workers AI", () => {
    const wav = pcm16ToWav(new Uint8Array([1, 2, 3, 4]));
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(16_000);
    expect(wav.slice(44)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("transcribes a completed Hindi utterance through the Workers AI binding", async () => {
    const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
    const ai = {
      run: async (model: string, input: Record<string, unknown>) => {
        calls.push({ model, input });
        return { text: "मेरा हीमोग्लोबिन कितना है?" };
      },
    } as unknown as Ai;
    const transcript = new Promise<string>((resolve, reject) => {
      const session = new WorkersAIWhisperTranscriber(ai, "hi-IN").createSession({
        onUtterance: resolve,
        onFatalError: reject,
      });
      session.feed(new Int16Array(3_200).fill(12_000).buffer);
      session.feed(new Int16Array(12_000).buffer);
    });

    await expect(transcript).resolves.toBe("मेरा हीमोग्लोबिन कितना है?");
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe("@cf/openai/whisper-large-v3-turbo");
    expect(calls[0].input.language).toBe("hi");
    expect(String(calls[0].input.audio)).toMatch(/^UklGR/);
  });

  it("drops noise-only transcripts but preserves short patient answers", () => {
    expect(cleanVoiceTranscript("[background noise]")).toBeNull();
    expect(cleanVoiceTranscript(" um... ")).toBeNull();
    expect(cleanVoiceTranscript("no")).toBe("no");
    expect(cleanVoiceTranscript("हाँ")).toBe("हाँ");
  });

  it("keeps the call alive when a transcription attempt fails", async () => {
    const fatal = vi.fn();
    const uttered = vi.fn();
    const ai = {
      run: async () => {
        throw new Error("Binding AI needs to be run remotely");
      },
    } as unknown as Ai;
    const session = new WorkersAIWhisperTranscriber(ai, "en-IN").createSession({
      onUtterance: uttered,
      onFatalError: fatal,
    });
    session.feed(new Int16Array(3_200).fill(12_000).buffer);
    session.feed(new Int16Array(12_000).buffer);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(fatal).not.toHaveBeenCalled();
    expect(uttered).not.toHaveBeenCalled();
    session.close();
  });

  it("retries one transient Workers AI transcription failure", async () => {
    const uttered = vi.fn();
    const run = vi.fn()
      .mockRejectedValueOnce(new Error("remote binding is not ready"))
      .mockResolvedValueOnce({ text: "What are my latest results?" });
    const session = new WorkersAIWhisperTranscriber({ run } as unknown as Ai, "en-IN").createSession({
      onUtterance: uttered,
    });
    session.feed(new Int16Array(3_200).fill(12_000).buffer);
    session.feed(new Int16Array(11_200).buffer);
    await vi.waitFor(() => expect(uttered).toHaveBeenCalledWith("What are my latest results?"), {
      timeout: 1_500,
    });
    expect(run).toHaveBeenCalledTimes(2);
    session.close();
  });

  it("measures PCM energy for adaptive voice activity detection", () => {
    const silence = new Int16Array(320).buffer;
    const speech = new Int16Array(320).fill(12_000).buffer;
    expect(pcm16Rms(silence)).toBe(0);
    expect(pcm16Rms(speech)).toBeGreaterThan(0.3);
  });
});
