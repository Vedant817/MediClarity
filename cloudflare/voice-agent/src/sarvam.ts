import type {
  StreamingTTSProvider,
  Transcriber,
  TranscriberSession,
  TranscriberSessionOptions,
} from "@cloudflare/voice";
import { VOICE_LANGUAGES, type VoiceLocale } from "./languages";
import { pcm16Rms } from "./transcript-filter";

const SAMPLE_RATE = 16_000;
const MIN_SPEECH_MS = 180;
const END_SILENCE_MS = 560;
const MAX_UTTERANCE_MS = 25_000;
const PRE_ROLL_MS = 180;

function timeoutSignal(signal: AbortSignal | undefined, milliseconds: number): AbortSignal {
  const timeout = AbortSignal.timeout(milliseconds);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function concatenate(chunks: ArrayBuffer[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function transcribe(
  apiKey: string,
  locale: VoiceLocale,
  audio: Uint8Array,
  signal: AbortSignal,
): Promise<string> {
  const form = new FormData();
  const audioBuffer = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
  form.set("file", new Blob([audioBuffer], { type: "application/octet-stream" }), "utterance.pcm");
  form.set("model", "saaras:v4");
  form.set("mode", "transcribe");
  form.set("language_code", locale);
  form.set("input_audio_codec", "pcm_s16le");

  const response = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": apiKey },
    body: form,
    signal,
  });
  if (!response.ok) throw new Error(`speech recognition failed (${response.status})`);
  const result = await response.json() as { transcript?: unknown };
  if (typeof result.transcript !== "string") throw new Error("speech recognition returned no transcript");
  return result.transcript.trim();
}

class SarvamTranscriberSession implements TranscriberSession {
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
    private readonly apiKey: string,
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
      const transcript = await transcribe(
        this.apiKey,
        this.locale,
        audio,
        timeoutSignal(this.abortController.signal, 12_000),
      );
      if (!this.closed && transcript) this.options.onUtterance?.(transcript);
    }).catch((error: unknown) => {
      if (!this.closed) this.options.onFatalError?.(error instanceof Error ? error : new Error("speech recognition failed"));
    });
  }
}

export class SarvamTranscriber implements Transcriber {
  constructor(private readonly apiKey: string, private readonly locale: VoiceLocale) {}

  createSession(options: TranscriberSessionOptions = {}): TranscriberSession {
    return new SarvamTranscriberSession(this.apiKey, this.locale, options);
  }
}

export class SarvamStreamingTTS implements StreamingTTSProvider {
  constructor(private readonly apiKey: string, private readonly locale: VoiceLocale) {}

  async synthesize(text: string, signal?: AbortSignal): Promise<ArrayBuffer | null> {
    const chunks: ArrayBuffer[] = [];
    for await (const chunk of this.synthesizeStream(text, signal)) chunks.push(chunk);
    return chunks.length ? concatenate(chunks).buffer as ArrayBuffer : null;
  }

  async *synthesizeStream(text: string, signal?: AbortSignal): AsyncGenerator<ArrayBuffer> {
    const response = await fetch("https://api.sarvam.ai/text-to-speech/stream", {
      method: "POST",
      headers: {
        "api-subscription-key": this.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 3_500),
        language_code: this.locale,
        speaker: VOICE_LANGUAGES[this.locale].speaker,
        model: "bulbul:v3",
        pace: 1.04,
        temperature: 0.55,
        output_audio_codec: "mp3",
        enable_preprocessing: true,
      }),
      signal: timeoutSignal(signal, 15_000),
    });
    if (!response.ok || !response.body) throw new Error(`speech synthesis failed (${response.status})`);
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength) yield value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      }
    } finally {
      reader.releaseLock();
    }
  }
}
