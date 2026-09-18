import type {
  Transcriber,
  TranscriberSession,
  TranscriberSessionOptions,
} from "@cloudflare/voice";
import { whisperLanguage, type VoiceLocale } from "./languages";
import type { PatientContext } from "./patient-context";
import { isHallucinatedLabDump, looksLikeWordSalad, pcm16Rms, spokenRequestScore } from "./transcript-filter";

const SAMPLE_RATE = 16_000;
const MIN_SPEECH_MS = 180;
const END_SILENCE_MS = 800;
const MAX_UTTERANCE_MS = 25_000;
const PRE_ROLL_MS = 240;
const TRANSCRIBE_RETRY_MS = 600;
const MAX_PROMPT_CHARACTERS = 800;
const MAX_KEYTERMS = 32;
export const NOVA_CONFIDENCE_THRESHOLD = 0.78;
export const NOVA_CONFIRM_MIN_CONFIDENCE = 0.55;
export const NOVA_NO_SPEECH_CONFIDENCE = 0.2;
const VOICE_CONFIRM_PREFIX = "\u001eCONFIRM:";
const VOICE_REPEAT_PREFIX = "\u001eREPEAT:";
const WEAK_TERM = /^(?:[\d.%]+|\d+\s*(?:mg|mcg|g|ml|iu|%|mmol)|mg|ml|pg|ng|dl|iu|mmol|mcg|%)$/i;
const INTENT_KEYTERMS = [
  "recent reports",
  "latest reports",
  "reports",
  "precautions",
  "precaution",
  "lab results",
  "medications",
  "appointment",
  "hemoglobin",
  "three or four",
  "four reports",
  "use my",
];

// Cloudflare's hosted Nova-3 route is used for Indian English and Hindi.
// Remaining configured languages stay on Whisper Large v3 Turbo. Medical
// vocabulary is supplied as keyterms because the hosted route rejects the
// Nova medical tier.
const NOVA_LOCALES = new Set<VoiceLocale>(["en-IN", "hi-IN"]);

const MEDICAL_PROMPT: Record<VoiceLocale, string> = {
  "en-IN": "Indian English medical conversation. Preserve exact test names, medicine names, numbers, and units.",
  "hi-IN": "यह चिकित्सा संबंधी बातचीत है। जाँच, दवा, संख्या और इकाई के नाम ठीक लिखें।",
  "pa-IN": "ਇਹ ਡਾਕਟਰੀ ਗੱਲਬਾਤ ਹੈ। ਟੈਸਟ, ਦਵਾਈ, ਨੰਬਰ ਅਤੇ ਇਕਾਈਆਂ ਦੇ ਨਾਮ ਠੀਕ ਲਿਖੋ।",
  "bn-IN": "এটি চিকিৎসা-সংক্রান্ত কথোপকথন। পরীক্ষা, ওষুধ, সংখ্যা ও এককের নাম ঠিকভাবে লিখুন।",
  "ta-IN": "இது மருத்துவ உரையாடல். பரிசோதனை, மருந்து, எண் மற்றும் அலகுகளின் பெயர்களைத் துல்லியமாக எழுதவும்.",
  "te-IN": "ఇది వైద్య సంభాషణ. పరీక్షలు, మందులు, సంఖ్యలు మరియు యూనిట్ల పేర్లను సరిగ్గా రాయండి.",
  "mr-IN": "हे वैद्यकीय संभाषण आहे. चाचणी, औषध, संख्या आणि एककांची नावे अचूक लिहा.",
  "gu-IN": "આ તબીબી વાતચીત છે. તપાસ, દવા, સંખ્યા અને એકમોના નામ બરાબર લખો.",
  "kn-IN": "ಇದು ವೈದ್ಯಕೀಯ ಸಂಭಾಷಣೆ. ಪರೀಕ್ಷೆ, ಔಷಧಿ, ಸಂಖ್ಯೆ ಮತ್ತು ಘಟಕಗಳ ಹೆಸರುಗಳನ್ನು ಸರಿಯಾಗಿ ಬರೆಯಿರಿ.",
  "ml-IN": "ഇത് ഒരു മെഡിക്കൽ സംഭാഷണമാണ്. പരിശോധന, മരുന്ന്, സംഖ്യ, യൂണിറ്റ് എന്നിവയുടെ പേരുകൾ കൃത്യമായി എഴുതുക.",
};

function promptTerm(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/[^\p{L}\p{N}\s.%/+()-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || null;
}

function distinctiveTerms(value: string | undefined): string[] {
  const cleaned = promptTerm(value);
  if (!cleaned || WEAK_TERM.test(cleaned) || cleaned.length < 4) return [];
  const terms = [cleaned];
  for (const match of cleaned.matchAll(/\(([^)]+)\)/g)) {
    const inner = promptTerm(match[1]);
    if (inner && inner.length >= 4 && !WEAK_TERM.test(inner)) terms.push(inner);
  }
  return terms;
}

export function buildMedicalKeyterms(context?: PatientContext): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  const add = (candidate: string | undefined) => {
    for (const term of distinctiveTerms(candidate)) {
      const key = term.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push(term);
      if (terms.length >= MAX_KEYTERMS) return false;
    }
    return true;
  };
  for (const term of INTENT_KEYTERMS) {
    if (!add(term)) return terms;
  }
  if (!context) return terms;
  const candidates = [
    ...context.activeMedications.map((medication) => medication.name),
    ...context.medicationHistory.map((medication) => medication.name),
    ...context.recentLabs.map((lab) => lab.test),
    ...context.upcomingAppointments.flatMap((appointment) => [appointment.providerName, appointment.specialty]),
    ...context.appointmentHistory.flatMap((appointment) => [appointment.providerName, appointment.specialty]),
    ...context.recentReports.map((report) => report.sourceLab),
  ];
  for (const candidate of candidates) {
    if (!add(candidate)) break;
  }
  return terms;
}

export function isNovaLocale(locale: VoiceLocale): boolean {
  return NOVA_LOCALES.has(locale);
}

export function buildMedicalTranscriptionPrompt(locale: VoiceLocale, context?: PatientContext): string {
  if (isNovaLocale(locale)) return MEDICAL_PROMPT[locale];
  const terms: string[] = [];
  for (const term of buildMedicalKeyterms(context).filter((candidate) => candidate.length >= 5).slice(0, 8)) {
    const next = `${MEDICAL_PROMPT[locale]} ${terms.length ? `${terms.join(", ")}, ` : ""}${term}.`;
    if (next.length > MAX_PROMPT_CHARACTERS) break;
    terms.push(term);
  }
  return terms.length ? `${MEDICAL_PROMPT[locale]} ${terms.join(", ")}.` : MEDICAL_PROMPT[locale];
}

export function novaLanguage(locale: VoiceLocale): string {
  return locale === "en-IN" ? "en-IN" : whisperLanguage(locale);
}

export function voiceConfirmationTranscript(heard: string): string {
  return `${VOICE_CONFIRM_PREFIX}${heard.trim()}`;
}

export function parseVoiceConfirmation(transcript: string): string | null {
  if (!transcript.startsWith(VOICE_CONFIRM_PREFIX)) return null;
  const heard = transcript.slice(VOICE_CONFIRM_PREFIX.length).replace(/\s+/g, " ").trim();
  return heard || null;
}

export function voiceRepeatTranscript(): string {
  return VOICE_REPEAT_PREFIX;
}

export function parseVoiceRepeat(transcript: string): boolean {
  return transcript === VOICE_REPEAT_PREFIX || transcript.startsWith(VOICE_REPEAT_PREFIX);
}

export function resolveNovaTranscript(
  nova: { transcript: string; confidence?: number },
  whisper = "",
): string {
  const novaText = nova.transcript.trim();
  const whisperText = whisper.trim();
  const novaScore = spokenRequestScore(novaText);
  const whisperScore = spokenRequestScore(whisperText);
  const confidence = nova.confidence;
  const substantial = (novaText.match(/\p{L}{2,}/gu) ?? []).length >= 4;
  const novaUsable = novaScore >= 4 || (
    novaText.length >= 2
    && !isHallucinatedLabDump(novaText)
    && !looksLikeWordSalad(novaText)
    && typeof confidence === "number"
    && confidence >= NOVA_CONFIDENCE_THRESHOLD
  ) || (
    substantial
    && !isHallucinatedLabDump(novaText)
    && typeof confidence === "number"
    && confidence >= NOVA_CONFIRM_MIN_CONFIDENCE
  );
  const whisperUsable = whisperScore >= 4;

  if (whisperUsable && whisperScore >= novaScore + 2) return whisperText;
  if (novaUsable && novaScore >= 6 && (confidence === undefined || confidence >= NOVA_CONFIRM_MIN_CONFIDENCE)) {
    return novaText;
  }
  if (novaUsable && (confidence === undefined || confidence >= NOVA_CONFIDENCE_THRESHOLD)) return novaText;
  if (
    novaUsable
    && typeof confidence === "number"
    && confidence >= NOVA_CONFIRM_MIN_CONFIDENCE
    && confidence < NOVA_CONFIDENCE_THRESHOLD
  ) {
    return voiceConfirmationTranscript(novaText);
  }
  if (whisperUsable) return whisperText;
  return voiceRepeatTranscript();
}

export function wavStream(wav: Uint8Array): ReadableStream<Uint8Array> {
  const bytes = new Uint8Array(wav.byteLength);
  bytes.set(wav);
  const body = new Response(bytes.buffer).body;
  if (body) return body as ReadableStream<Uint8Array>;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || /aborted|AbortError/i.test(error.message));
}

function aiErrorMetadata(error: unknown) {
  if (!error || typeof error !== "object") return { kind: typeof error };
  const candidate = error as { name?: unknown; message?: unknown; code?: unknown; status?: unknown };
  const message = typeof candidate.message === "string"
    ? candidate.message
        .replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-token]")
        .replace(/([?&](?:token|key|secret)=)[^&\s]+/gi, "$1[redacted]")
        .slice(0, 240)
    : undefined;
  return {
    name: typeof candidate.name === "string" ? candidate.name : "UnknownError",
    message,
    code: typeof candidate.code === "string" || typeof candidate.code === "number" ? candidate.code : undefined,
    status: typeof candidate.status === "number" ? candidate.status : undefined,
  };
}

function retryableAiError(error: unknown) {
  if (isAbortError(error)) return false;
  if (!error || typeof error !== "object") return true;
  const status = (error as { status?: unknown }).status;
  return typeof status !== "number" || status === 408 || status === 429 || status >= 500;
}

function abortableDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
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

function trimQuietEnds(chunks: ArrayBuffer[], threshold: number): ArrayBuffer[] {
  let start = 0;
  let end = chunks.length;
  while (start < end && pcm16Rms(chunks[start]) < threshold) start += 1;
  while (end > start && pcm16Rms(chunks[end - 1]) < threshold) end -= 1;
  return chunks.slice(start, end);
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

async function transcribeWhisper(
  ai: Ai,
  locale: VoiceLocale,
  audio: Uint8Array,
  initialPrompt: string,
  signal: AbortSignal,
): Promise<string> {
  const result = await ai.run("@cf/openai/whisper-large-v3-turbo", {
    audio: toBase64(pcm16ToWav(audio)),
    task: "transcribe",
    language: whisperLanguage(locale),
    vad_filter: true,
    initial_prompt: initialPrompt,
    beam_size: 5,
    condition_on_previous_text: false,
    no_speech_threshold: 0.72,
  }, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
  return typeof result.text === "string" ? result.text.trim() : "";
}

async function transcribeWithRetry(
  ai: Ai,
  locale: VoiceLocale,
  audio: Uint8Array,
  initialPrompt: string,
  signal: AbortSignal,
) {
  try {
    return await transcribeWhisper(ai, locale, audio, initialPrompt, signal);
  } catch (error) {
    if (!retryableAiError(error)) throw error;
    console.warn("voice.transcribe_retry", {
      ...aiErrorMetadata(error),
      audioBytes: audio.byteLength,
      audioMs: Math.round((audio.byteLength / 2 / SAMPLE_RATE) * 1_000),
    });
    await abortableDelay(TRANSCRIBE_RETRY_MS, signal);
    return transcribeWhisper(ai, locale, audio, initialPrompt, signal);
  }
}

interface NovaAlternative {
  transcript?: string;
  confidence?: number;
  words?: Array<{ confidence?: number }>;
}

function novaAlternative(result: unknown): NovaAlternative | undefined {
  if (!result || typeof result !== "object") return undefined;
  const results = (result as { results?: unknown }).results;
  if (!results || typeof results !== "object") return undefined;
  const channels = (results as { channels?: unknown }).channels;
  if (!Array.isArray(channels) || !channels[0] || typeof channels[0] !== "object") return undefined;
  const alternatives = (channels[0] as { alternatives?: unknown }).alternatives;
  if (!Array.isArray(alternatives) || !alternatives[0] || typeof alternatives[0] !== "object") return undefined;
  return alternatives[0] as NovaAlternative;
}

function novaConfidence(alternative: NovaAlternative): number | undefined {
  if (typeof alternative.confidence === "number") return alternative.confidence;
  const confidences = alternative.words
    ?.map((word) => word.confidence)
    .filter((confidence): confidence is number => typeof confidence === "number");
  if (!confidences?.length) return undefined;
  return confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length;
}

export function parseNovaStreamMessage(data: unknown): {
  kind: "speech_start" | "interim" | "final" | "ignore";
  transcript: string;
  confidence?: number;
  isFinal?: boolean;
} {
  if (!data || typeof data !== "object") return { kind: "ignore", transcript: "" };
  const message = data as Record<string, unknown>;
  if (message.type === "SpeechStarted") return { kind: "speech_start", transcript: "" };
  if (message.type !== "Results") return { kind: "ignore", transcript: "" };
  const channel = message.channel && typeof message.channel === "object"
    ? message.channel as { alternatives?: NovaAlternative[] }
    : undefined;
  const alternative = channel?.alternatives?.[0] ?? novaAlternative(message);
  const transcript = alternative?.transcript?.trim() ?? "";
  const confidence = alternative ? novaConfidence(alternative) : undefined;
  if (message.speech_final) return { kind: "final", transcript, confidence };
  if (transcript) return { kind: "interim", transcript, confidence, isFinal: message.is_final === true };
  return { kind: "ignore", transcript: "" };
}

interface NovaSocket {
  accept(): void;
  send(data: ArrayBuffer | string): void;
  close(): void;
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
}

async function transcribeBufferedWhisper(
  ai: Ai,
  locale: VoiceLocale,
  chunks: ArrayBuffer[],
  initialPrompt: string,
  signal: AbortSignal,
) {
  const speech = trimQuietEnds(chunks, 0.008);
  if (!speech.length) return "";
  const audio = concatenate(speech);
  if (audio.byteLength < 3_200) return "";
  try {
    return await transcribeWithRetry(ai, locale, audio, initialPrompt, signal);
  } catch (error) {
    if (isAbortError(error) && signal.aborted) throw error;
    console.warn("voice.whisper_fallback_failed", aiErrorMetadata(error));
    return "";
  }
}

class NovaStreamingSession implements TranscriberSession {
  private readonly abortController = new AbortController();
  private readonly pendingChunks: ArrayBuffer[] = [];
  private readonly utteranceChunks: ArrayBuffer[] = [];
  private ws: NovaSocket | null = null;
  private fallback: WhisperVadSession | null = null;
  private connected = false;
  private closed = false;
  private heardSpeech = false;
  private finalizedSegments: string[] = [];
  private pending = Promise.resolve();

  constructor(
    private readonly ai: Ai,
    private readonly locale: VoiceLocale,
    private readonly initialPrompt: string,
    private readonly keyterms: string[],
    private readonly options: TranscriberSessionOptions,
  ) {
    void this.connect();
  }

  feed(chunk: ArrayBuffer): void {
    if (this.closed || chunk.byteLength < 2) return;
    const copy = chunk.slice(0);
    if (this.fallback) {
      this.fallback.feed(copy);
      return;
    }
    this.utteranceChunks.push(copy);
    let buffered = this.utteranceChunks.reduce((total, item) => total + item.byteLength, 0);
    while (buffered > SAMPLE_RATE * 2 * 15 && this.utteranceChunks.length > 1) {
      const removed = this.utteranceChunks.shift();
      if (removed) buffered -= removed.byteLength;
    }
    if (this.connected && this.ws) this.ws.send(copy);
    else this.pendingChunks.push(copy);
  }

  close(): void {
    this.closed = true;
    this.abortController.abort();
    this.pendingChunks.length = 0;
    this.utteranceChunks.length = 0;
    this.fallback?.close();
    if (this.ws) {
      try { this.ws.close(); } catch { /* already closed */ }
      this.ws = null;
    }
    this.connected = false;
  }

  private async connect(): Promise<void> {
    try {
      const input: Record<string, unknown> = {
        encoding: "linear16",
        sample_rate: String(SAMPLE_RATE),
        language: novaLanguage(this.locale),
        interim_results: "true",
        vad_events: "true",
        endpointing: "500",
        utterance_end_ms: "1500",
        smart_format: "true",
        punctuate: "true",
        measurements: "true",
        filler_words: "false",
        mip_opt_out: "true",
      };
      if (this.keyterms.length) input.keyterm = this.keyterms;
      const response = await this.ai.run(
        "@cf/deepgram/nova-3",
        input as unknown as Ai_Cf_Deepgram_Nova_3_Input,
        { websocket: true } as Record<string, unknown>,
      ) as { webSocket?: NovaSocket };
      if (this.closed) {
        response.webSocket?.accept();
        response.webSocket?.close();
        return;
      }
      const ws = response.webSocket;
      if (!ws) throw new Error("Workers AI Nova-3 STT did not return a WebSocket");
      ws.accept();
      this.ws = ws;
      this.connected = true;
      ws.addEventListener("message", (event) => this.handleMessage(event));
      ws.addEventListener("close", () => {
        this.connected = false;
        if (!this.closed) this.useWhisperFallback("websocket_close");
      });
      ws.addEventListener("error", () => {
        this.connected = false;
        if (!this.closed) this.useWhisperFallback("websocket_error");
      });
      for (const chunk of this.pendingChunks) ws.send(chunk);
      this.pendingChunks.length = 0;
    } catch (error) {
      if (this.closed || isAbortError(error)) return;
      console.warn("voice.nova_fallback", { reason: "provider_error", ...aiErrorMetadata(error) });
      this.useWhisperFallback("provider_error");
    }
  }

  private useWhisperFallback(reason: string): void {
    if (this.fallback || this.closed) return;
    console.warn("voice.nova_fallback", { reason });
    this.fallback = new WhisperVadSession(this.ai, this.locale, this.initialPrompt, this.options);
    const queued = this.utteranceChunks.length ? this.utteranceChunks : this.pendingChunks;
    for (const chunk of queued) this.fallback.feed(chunk);
    this.pendingChunks.length = 0;
  }

  private handleMessage(event: { data?: unknown }): void {
    if (this.closed) return;
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) as unknown : event.data;
      const parsed = parseNovaStreamMessage(data);
      if (parsed.kind === "speech_start") {
        this.heardSpeech = true;
        this.options.onSpeechStart?.();
        return;
      }
      if (parsed.kind === "interim" && parsed.transcript) {
        this.heardSpeech = true;
        if (parsed.isFinal) this.finalizedSegments.push(parsed.transcript);
        const display = this.finalizedSegments.length
          ? `${this.finalizedSegments.join(" ")} ${parsed.isFinal ? "" : parsed.transcript}`.trim()
          : parsed.transcript;
        this.options.onInterim?.(display);
        return;
      }
      if (parsed.kind === "final") {
        if (parsed.transcript) this.finalizedSegments.push(parsed.transcript);
        const transcript = this.finalizedSegments.join(" ").trim() || parsed.transcript;
        this.finalizedSegments = [];
        const chunks = this.utteranceChunks.splice(0);
        this.pending = this.pending.then(() => this.finishUtterance(transcript, parsed.confidence, chunks));
      }
    } catch {
      /* ignore malformed provider frames */
    }
  }

  private async finishUtterance(transcript: string, confidence: number | undefined, chunks: ArrayBuffer[]): Promise<void> {
    if (this.closed) return;
    const heardSpeech = this.heardSpeech;
    this.heardSpeech = false;
    let whisper = "";
    let resolved = resolveNovaTranscript({ transcript, confidence }, whisper);
    if (parseVoiceRepeat(resolved)) {
      whisper = await transcribeBufferedWhisper(
        this.ai,
        this.locale,
        chunks,
        this.initialPrompt,
        this.abortController.signal,
      );
      resolved = resolveNovaTranscript({ transcript, confidence }, whisper);
    }
    if (parseVoiceRepeat(resolved) && !heardSpeech && spokenRequestScore(transcript) < 4) {
      return;
    }
    if (parseVoiceRepeat(resolved) || parseVoiceConfirmation(resolved)) {
      console.warn(parseVoiceRepeat(resolved) ? "voice.nova_repeat" : "voice.nova_confirmation", {
        confidence,
        audioBytes: chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
      });
    }
    if (!this.closed && resolved) this.options.onUtterance?.(resolved);
  }
}

class WhisperVadSession implements TranscriberSession {
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
    private readonly initialPrompt: string,
    private readonly options: TranscriberSessionOptions,
  ) {}

  feed(chunk: ArrayBuffer): void {
    if (this.closed || chunk.byteLength < 2) return;
    const copy = chunk.slice(0);
    const durationMs = (copy.byteLength / 2 / SAMPLE_RATE) * 1_000;
    const rms = pcm16Rms(copy);
    const speechThreshold = Math.max(0.01, Math.min(0.032, this.noiseFloor * 2.3));

    if (!this.speaking) {
      this.noiseFloor = Math.max(0.002, Math.min(0.025, this.noiseFloor * 0.96 + rms * 0.04));
      this.preRoll.push(copy);
      this.preRollMs += durationMs;
      while (this.preRollMs > PRE_ROLL_MS && this.preRoll.length > 1) {
        const removed = this.preRoll.shift();
        if (removed) this.preRollMs -= (removed.byteLength / 2 / SAMPLE_RATE) * 1_000;
      }
      this.possibleSpeechMs = rms >= speechThreshold ? this.possibleSpeechMs + durationMs : 0;
      if (this.possibleSpeechMs >= 140) {
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
    const speech = trimQuietEnds(chunks, 0.01);
    if (duration < MIN_SPEECH_MS || !speech.length) return;
    const audio = concatenate(speech);
    this.pending = this.pending.then(async () => {
      if (this.closed) return;
      try {
        const whisper = await transcribeWithRetry(
          this.ai,
          this.locale,
          audio,
          this.initialPrompt,
          this.abortController.signal,
        );
        const transcript = spokenRequestScore(whisper) >= 4 ? whisper : voiceRepeatTranscript();
        if (!this.closed && transcript) this.options.onUtterance?.(transcript);
      } catch (error: unknown) {
        if (this.closed || isAbortError(error)) return;
        console.error("voice.transcribe_failed", {
          ...aiErrorMetadata(error),
          audioBytes: audio.byteLength,
          audioMs: Math.round((audio.byteLength / 2 / SAMPLE_RATE) * 1_000),
        });
        this.options.onUtterance?.(voiceRepeatTranscript());
      }
    });
  }
}

export class WorkersAIHybridTranscriber implements Transcriber {
  constructor(
    private readonly ai: Ai,
    private readonly locale: VoiceLocale,
    private readonly initialPrompt = buildMedicalTranscriptionPrompt(locale),
    private readonly keyterms: string[] = [],
  ) {}

  createSession(options: TranscriberSessionOptions = {}): TranscriberSession {
    if (isNovaLocale(this.locale)) {
      return new NovaStreamingSession(this.ai, this.locale, this.initialPrompt, this.keyterms, options);
    }
    return new WhisperVadSession(this.ai, this.locale, this.initialPrompt, options);
  }
}
