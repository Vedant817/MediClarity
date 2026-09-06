import { describe, expect, it } from "vitest";
import { greetingFor, isVoiceLocale } from "../src/languages";
import { cleanVoiceTranscript, pcm16Rms } from "../src/transcript-filter";

describe("multilingual speech safety", () => {
  it("recognizes only configured voice locales and localizes greetings", () => {
    expect(isVoiceLocale("pa-IN")).toBe(true);
    expect(isVoiceLocale("es-ES")).toBe(false);
    expect(greetingFor("hi-IN", "Asha")).toContain("नमस्ते Asha");
    expect(greetingFor("pa-IN")).toContain("ਸਤ ਸ੍ਰੀ ਅਕਾਲ");
  });

  it("drops noise-only transcripts but preserves short patient answers", () => {
    expect(cleanVoiceTranscript("[background noise]")).toBeNull();
    expect(cleanVoiceTranscript(" um... ")).toBeNull();
    expect(cleanVoiceTranscript("no")).toBe("no");
    expect(cleanVoiceTranscript("हाँ")).toBe("हाँ");
  });

  it("measures PCM energy for adaptive voice activity detection", () => {
    const silence = new Int16Array(320).buffer;
    const speech = new Int16Array(320).fill(12_000).buffer;
    expect(pcm16Rms(silence)).toBe(0);
    expect(pcm16Rms(speech)).toBeGreaterThan(0.3);
  });
});
