import type {
  Transcriber,
  TranscriberSession,
  TranscriberSessionOptions,
} from "@cloudflare/voice";
import { whisperLanguage, type VoiceLocale } from "./languages";
import { pcm16Rms } from "./transcript-filter";

const SAMPLE_RATE = 16_000;
const MIN_SPEECH_MS = 180;
const END_SILENCE_MS = 560;
const MAX_UTTERANCE_MS = 25_000;
const PRE_ROLL_MS = 180;

function concatenate(chunks: ArrayBuffer[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  return output;
}

export function pcm16ToWav(pcm: Uint8Array): Uint8Array {
  const wav = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(wav.buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) wav[offset + index] = value.charCodeAt(index);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, 44);
  return wav;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function transcribe(
  ai: Ai,
  locale: VoiceLocale,
  audio: Uint8Array,
  signal: AbortSignal,
): Promise<string> {
  const result = await ai.run("@cf/openai/whisper-large-v3-turbo", {
    audio: toBase64(pcm16ToWav(audio)),
    task: "transcribe",
    language: whisperLanguage(locale),
    vad_filter: true,
    initial_prompt: "A patient discussing medical reports, laboratory tests, medications, doses, and appointments.",
    condition_on_previous_text: false,
    no_speech_threshold: 0.62,
  }, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
  return typeof result.text === "string" ? result.text.trim() : "";
}

class WorkersAIWhisperSession implements TranscriberSession {
  private readonly abortController = new AbortController();
  private readonly preRoll: ArrayBuffer[] = [];
  private speechChunks: ArrayBuffer[] = [];
  private noiseFloor = 0.004;
  private possibleSpeechMs = 0;
  private speechMs = 0;
  private silenceMs = 0;
  private preRollMs = 0;
  private speaking = false;
  private closed = false;
  private pending = Promise.resolve();

  constructor(
    private readonly ai: Ai,
    private readonly locale: VoiceLocale,
    private readonly options: TranscriberSessionOptions,
  ) {}

  feed(chunk: ArrayBuffer): void {
    if (this.closed || chunk.byteLength < 2) return;
    const copy = chunk.slice(0);
    const durationMs = (copy.byteLength / 2 / SAMPLE_RATE) * 1_000;
    const rms = pcm16Rms(copy);
    const speechThreshold = Math.max(0.014, Math.min(0.05, this.noiseFloor * 2.8));

    if (!this.speaking) {
      this.noiseFloor = Math.max(0.002, Math.min(0.025, this.noiseFloor * 0.96 + rms * 0.04));
      this.preRoll.push(copy);
      this.preRollMs += durationMs;
      while (this.preRollMs > PRE_ROLL_MS && this.preRoll.length > 1) {
        const removed = this.preRoll.shift();
        if (removed) this.preRollMs -= (removed.byteLength / 2 / SAMPLE_RATE) * 1_000;
      }
      this.possibleSpeechMs = rms >= speechThreshold ? this.possibleSpeechMs + durationMs : 0;
      if (this.possibleSpeechMs >= 100) {
        this.speaking = true;
        this.speechChunks = this.preRoll.splice(0);
        this.speechMs = this.preRollMs;
        this.preRollMs = 0;
        this.silenceMs = 0;
        this.options.onSpeechStart?.();
      }
      return;
    }

    this.speechChunks.push(copy);
    this.speechMs += durationMs;
    this.silenceMs = rms >= speechThreshold * 0.72 ? 0 : this.silenceMs + durationMs;
    if (this.silenceMs >= END_SILENCE_MS || this.speechMs >= MAX_UTTERANCE_MS) this.finalize();
  }

  close(): void {
    this.closed = true;
    this.abortController.abort();
    this.speechChunks = [];
    this.preRoll.length = 0;
  }

  private finalize(): void {
    const chunks = this.speechChunks;
    const duration = this.speechMs - this.silenceMs;
    this.speechChunks = [];
    this.speaking = false;
    this.speechMs = 0;
    this.silenceMs = 0;
    this.possibleSpeechMs = 0;
    if (duration < MIN_SPEECH_MS || !chunks.length) return;
    const audio = concatenate(chunks);
    this.pending = this.pending.then(async () => {
      if (this.closed) return;
      const transcript = await transcribe(this.ai, this.locale, audio, this.abortController.signal);
      if (!this.closed && transcript) this.options.onUtterance?.(transcript);
    }).catch((error: unknown) => {
      if (!this.closed) this.options.onFatalError?.(error instanceof Error ? error : new Error("speech recognition failed"));
    });
  }
}

export class WorkersAIWhisperTranscriber implements Transcriber {
  constructor(private readonly ai: Ai, private readonly locale: VoiceLocale) {}

  createSession(options: TranscriberSessionOptions = {}): TranscriberSession {
    return new WorkersAIWhisperSession(this.ai, this.locale, options);
  }
}
