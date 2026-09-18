import { describe, expect, it, vi } from "vitest";
import { confirmationFor, greetingFor, isVoiceLocale, repeatFor, whisperLanguage } from "../src/languages";
import {
  cleanVoiceTranscript,
  isHallucinatedLabDump,
  pcm16Rms,
  spokenRequestScore,
} from "../src/transcript-filter";
import type { PatientContext } from "../src/patient-context";
import {
  buildMedicalTranscriptionPrompt,
  buildMedicalKeyterms,
  isNovaLocale,
  novaLanguage,
  parseNovaStreamMessage,
  parseVoiceConfirmation,
  parseVoiceRepeat,
  pcm16ToWav,
  resolveNovaTranscript,
  voiceConfirmationTranscript,
  voiceRepeatTranscript,
  WorkersAIHybridTranscriber,
} from "../src/workers-ai-stt";

function mockNovaSocket() {
  const listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();
  const ws = {
    accept() {},
    addEventListener(type: string, listener: (event: { data?: unknown }) => void) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    send() {},
    close() {},
  };
  return {
    ws,
    emit(payload: unknown) {
      for (const listener of listeners.get("message") ?? []) {
        listener({ data: JSON.stringify(payload) });
      }
    },
  };
}

function novaResult(transcript: string, confidence: number, speechFinal = true) {
  return {
    type: "Results",
    speech_final: speechFinal,
    is_final: true,
    channel: { alternatives: [{ transcript, confidence }] },
  };
}

async function openNovaSession(
  run: ReturnType<typeof vi.fn>,
  locale: "en-IN" | "hi-IN" = "en-IN",
  keyterms: string[] = [],
) {
  const socket = mockNovaSocket();
  run.mockResolvedValueOnce({ webSocket: socket.ws });
  const uttered = vi.fn();
  const session = new WorkersAIHybridTranscriber(
    { run } as unknown as Ai,
    locale,
    "medical prompt",
    keyterms,
  ).createSession({ onUtterance: uttered });
  await vi.waitFor(() => expect(run).toHaveBeenCalledWith(
    "@cf/deepgram/nova-3",
    expect.objectContaining({ encoding: "linear16", language: novaLanguage(locale) }),
    expect.objectContaining({ websocket: true }),
  ));
  return { session, uttered, socket };
}

function speakInto(session: { feed(chunk: ArrayBuffer): void }) {
  session.feed(new Int16Array(3_200).fill(12_000).buffer);
  session.feed(new Int16Array(16_000).buffer);
}

async function speakWhisper(
  session: { feed(chunk: ArrayBuffer): void; close(): void },
  uttered: ReturnType<typeof vi.fn>,
) {
  speakInto(session);
  await vi.waitFor(() => expect(uttered).toHaveBeenCalled(), { timeout: 1_500 });
  session.close();
}

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

  it("routes only Indian English and Hindi to Nova-3", () => {
    expect(isNovaLocale("en-IN")).toBe(true);
    expect(isNovaLocale("hi-IN")).toBe(true);
    expect(isNovaLocale("pa-IN")).toBe(false);
    expect(isNovaLocale("bn-IN")).toBe(false);
    expect(isNovaLocale("ta-IN")).toBe(false);
    expect(isNovaLocale("te-IN")).toBe(false);
    expect(isNovaLocale("mr-IN")).toBe(false);
    expect(isNovaLocale("gu-IN")).toBe(false);
    expect(isNovaLocale("kn-IN")).toBe(false);
    expect(isNovaLocale("ml-IN")).toBe(false);
    expect(novaLanguage("en-IN")).toBe("en-IN");
    expect(novaLanguage("hi-IN")).toBe("hi");
  });

  it("opens a continuous Nova-3 websocket for a completed Hindi utterance", async () => {
    const run = vi.fn();
    const { session, uttered, socket } = await openNovaSession(run, "hi-IN");
    speakInto(session);
    socket.emit(novaResult("मेरा हीमोग्लोबिन कितना है?", 0.96));
    await vi.waitFor(() => expect(uttered).toHaveBeenCalledWith("मेरा हीमोग्लोबिन कितना है?"));
    expect(run.mock.calls[0][1]).toMatchObject({
      language: "hi",
      encoding: "linear16",
      mip_opt_out: "true",
      smart_format: "true",
    });
    expect(parseNovaStreamMessage({ type: "SpeechStarted" }).kind).toBe("speech_start");
    session.close();
  });

  it("boosts report and precaution phrases without feeding lab units into Whisper", () => {
    const context: PatientContext = {
      preferences: { locale: "en-IN" },
      recentReports: [{ sourceLab: "City Lab", summary: "private summary must not enter speech recognition" }],
      recentLabs: [{ test: "Glycated Hemoglobin (HbA1c)", value: 6.1, unit: "%" }],
      activeMedications: [{ name: "Metformin XR", dose: "500 mg" }],
      medicationHistory: [],
      upcomingAppointments: [{ date: "2026-09-20", providerName: "Dr. Rao", specialty: "Endocrinology" }],
      appointmentHistory: [],
      recordCounts: { reportCount: 1, labCount: 1, medicationCount: 1, appointmentCount: 1 },
    };
    const prompt = buildMedicalTranscriptionPrompt("en-IN", context);
    const keyterms = buildMedicalKeyterms(context);
    expect(prompt).toBe("Indian English medical conversation. Preserve exact test names, medicine names, numbers, and units.");
    expect(prompt).not.toContain("private summary");
    expect(keyterms).toContain("precautions");
    expect(keyterms).toContain("recent reports");
    expect(keyterms).toContain("latest reports");
    expect(keyterms).toContain("Glycated Hemoglobin (HbA1c)");
    expect(keyterms).toContain("HbA1c");
    expect(keyterms).toContain("Metformin XR");
    expect(keyterms).toContain("Dr. Rao");
    expect(keyterms).not.toContain("%");
    expect(keyterms).not.toContain("500 mg");
    expect(keyterms).not.toContain("private summary must not enter speech recognition");
  });

  it("rejects lab-name hallucinations and prefers a real report/precaution request", () => {
    const dump = "MNG, MCH, pg, MCV, MCH, NG, MCH, pg, MCV, FG, MCH, mL, tru, T3, T4, T0.";
    const salad = "So I can move my using to give you the tools and degree amount of precaution that you take.";
    const intended = "Based on my recent three or four reports, what precautions should I take?";
    expect(isHallucinatedLabDump(dump)).toBe(true);
    expect(cleanVoiceTranscript(dump)).toBeNull();
    expect(spokenRequestScore(dump)).toBe(0);
    expect(spokenRequestScore(salad)).toBe(0);
    expect(spokenRequestScore(intended)).toBeGreaterThanOrEqual(6);
    const close = "Can you remove the most three, four latest reports and give those precautions, use of shifting?";
    expect(resolveNovaTranscript({ transcript: "", confidence: 0.066 })).toBe(voiceRepeatTranscript());
    expect(resolveNovaTranscript({ transcript: salad, confidence: 0.405 })).toBe(voiceRepeatTranscript());
    expect(resolveNovaTranscript({ transcript: salad, confidence: 0.405 }, intended)).toBe(intended);
    expect(resolveNovaTranscript({ transcript: intended, confidence: 0.94 })).toBe(intended);
    expect(resolveNovaTranscript({ transcript: close, confidence: 0.61 })).toBe(close);
    expect(parseVoiceRepeat(voiceRepeatTranscript())).toBe(true);
    expect(repeatFor("en-IN")).toContain("Please say it again");
  });

  it("uses Indian English and patient-specific medical keyterms", async () => {
    const run = vi.fn();
    const { session, uttered, socket } = await openNovaSession(run, "en-IN", ["HbA1c", "Metformin XR"]);
    speakInto(session);
    socket.emit(novaResult("What was my HbA1c?", 0.94));
    await vi.waitFor(() => expect(uttered).toHaveBeenCalledWith("What was my HbA1c?"));
    expect(run).toHaveBeenCalledWith(
      "@cf/deepgram/nova-3",
      expect.objectContaining({ language: "en-IN", keyterm: ["HbA1c", "Metformin XR"] }),
      expect.objectContaining({ websocket: true }),
    );
    session.close();
  });

  it("does not confirm a low-confidence word salad when Whisper also fails", async () => {
    const salad = "So I can move my using to give you the tools and degree amount of precaution that you take.";
    const run = vi.fn();
    const { session, uttered, socket } = await openNovaSession(run);
    run.mockResolvedValueOnce({ text: "MNG, MCH, pg, MCV, MCH, NG, MCH, pg, MCV, FG, MCH, mL, tru, T3, T4, T0." });
    speakInto(session);
    socket.emit({ type: "SpeechStarted" });
    socket.emit(novaResult(salad, 0.405));
    await vi.waitFor(() => expect(uttered).toHaveBeenCalledWith(voiceRepeatTranscript()), { timeout: 1_500 });
    expect(run.mock.calls.map(([model]) => model)).toEqual([
      "@cf/deepgram/nova-3",
      "@cf/openai/whisper-large-v3-turbo",
    ]);
    session.close();
  });

  it("uses a clearer Whisper transcript instead of confirming a weak Nova guess", async () => {
    const salad = "So I can move my using to give you the tools and degree amount of precaution that you take.";
    const run = vi.fn();
    const { session, uttered, socket } = await openNovaSession(run);
    run.mockResolvedValueOnce({ text: "Based on my recent three or four reports, what precautions should I take?" });
    speakInto(session);
    socket.emit({ type: "SpeechStarted" });
    socket.emit(novaResult(salad, 0.405));
    await vi.waitFor(() => expect(uttered).toHaveBeenCalledWith(
      "Based on my recent three or four reports, what precautions should I take?",
    ), { timeout: 1_500 });
    session.close();
  });

  it("asks for confirmation only when Nova is uncertain but the phrase is still plausible", async () => {
    const heard = "Please explain this today";
    const run = vi.fn();
    const { session, uttered, socket } = await openNovaSession(run);
    speakInto(session);
    socket.emit(novaResult(heard, 0.62));
    await vi.waitFor(() => expect(uttered).toHaveBeenCalled());
    expect(parseVoiceConfirmation(uttered.mock.calls[0][0])).toBe(heard);
    expect(confirmationFor("en-IN", heard)).toContain("Is that what you meant?");
    session.close();
  });

  it("stays silent when Nova finalizes without hearing speech", async () => {
    const run = vi.fn();
    const { session, uttered, socket } = await openNovaSession(run);
    socket.emit(novaResult("", 0));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(uttered).not.toHaveBeenCalled();
    expect(run.mock.calls.map(([model]) => model)).toEqual(["@cf/deepgram/nova-3"]);
    session.close();
  });

  it("uses Whisper directly for Punjabi, Bengali, and Malayalam", async () => {
    for (const locale of ["pa-IN", "bn-IN", "ml-IN"] as const) {
      const run = vi.fn().mockResolvedValue({ text: "latest results" });
      const uttered = vi.fn();
      const session = new WorkersAIHybridTranscriber({ run } as unknown as Ai, locale).createSession({
        onUtterance: uttered,
      });
      await speakWhisper(session, uttered);
      expect(run.mock.calls[0][0]).toBe("@cf/openai/whisper-large-v3-turbo");
    }
  });

  it("keeps a natural pause inside one medical utterance", async () => {
    const run = vi.fn().mockResolvedValue({ text: "What was my hemoglobin level yesterday?" });
    const uttered = vi.fn();
    const session = new WorkersAIHybridTranscriber({ run } as unknown as Ai, "pa-IN").createSession({
      onUtterance: uttered,
    });
    session.feed(new Int16Array(3_200).fill(12_000).buffer);
    session.feed(new Int16Array(11_200).buffer);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(run).not.toHaveBeenCalled();
    session.feed(new Int16Array(3_200).fill(12_000).buffer);
    session.feed(new Int16Array(16_000).buffer);
    await vi.waitFor(() => expect(uttered).toHaveBeenCalledOnce(), { timeout: 500 });
    expect(run).toHaveBeenCalledOnce();
    session.close();
  });

  it("recognizes quiet speech without treating room silence as speech", async () => {
    const run = vi.fn().mockResolvedValue({ text: "what is my vitamin D" });
    const uttered = vi.fn();
    const session = new WorkersAIHybridTranscriber({ run } as unknown as Ai, "pa-IN").createSession({
      onUtterance: uttered,
    });
    session.feed(new Int16Array(3_200).fill(800).buffer);
    session.feed(new Int16Array(16_000).buffer);
    await vi.waitFor(() => expect(uttered).toHaveBeenCalledWith("what is my vitamin D"), { timeout: 500 });
    expect(run).toHaveBeenCalledOnce();
    session.close();
  });

  it("drops noise-only transcripts but preserves short patient answers", () => {
    expect(cleanVoiceTranscript("[background noise]")).toBeNull();
    expect(cleanVoiceTranscript(" um... ")).toBeNull();
    expect(cleanVoiceTranscript("MNG, MCH, pg, MCV, MCH, NG, MCH, pg, MCV, FG, MCH, mL, tru, T3, T4, T0.")).toBeNull();
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
    const session = new WorkersAIHybridTranscriber(ai, "en-IN").createSession({
      onUtterance: uttered,
      onFatalError: fatal,
    });
    session.feed(new Int16Array(3_200).fill(12_000).buffer);
    session.feed(new Int16Array(16_000).buffer);
    await vi.waitFor(() => expect(uttered).toHaveBeenCalledWith(voiceRepeatTranscript()), { timeout: 2_000 });
    expect(fatal).not.toHaveBeenCalled();
    session.close();
  });

  it("falls back to Whisper after a Nova provider failure", async () => {
    const uttered = vi.fn();
    const run = vi.fn()
      .mockRejectedValueOnce(new Error("remote binding is not ready"))
      .mockResolvedValueOnce({ text: "What are my latest results?" });
    const session = new WorkersAIHybridTranscriber({ run } as unknown as Ai, "en-IN").createSession({
      onUtterance: uttered,
    });
    session.feed(new Int16Array(3_200).fill(12_000).buffer);
    session.feed(new Int16Array(16_000).buffer);
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
