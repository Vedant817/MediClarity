"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useVoiceAgent, type VoiceStatus } from "@cloudflare/voice/react";
import {
  AlertCircle,
  Bot,
  CircleStop,
  HeartPulse,
  LoaderCircle,
  Languages,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Volume2,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  VOICE_LANGUAGES,
  type VoiceLocale,
  voiceLocaleForPreference,
} from "@/config/voice-languages";

type VoiceSession = {
  host: string;
  name: string;
  token: string;
  agent?: string;
  locale: VoiceLocale;
};

const stateCopy: Record<VoiceStatus, { label: string; detail: string }> = {
  idle: {
    label: "Ready when you are",
    detail: "Start a private voice session or type a question below.",
  },
  listening: {
    label: "Listening",
    detail: "Speak naturally. Pause when you are finished.",
  },
  thinking: {
    label: "Checking your record",
    detail: "MediClarity is preparing a grounded answer.",
  },
  speaking: {
    label: "Speaking",
    detail: "You can interrupt at any time—just start talking.",
  },
};

const waveform = [0.45, 0.72, 0.38, 0.88, 0.58, 1, 0.64, 0.82, 0.42, 0.7, 0.5];

function normalizeHost(host: string) {
  return host.replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "").replace(/\/$/, "");
}

function getSession(value: unknown): VoiceSession {
  if (!value || typeof value !== "object") {
    throw new Error("The voice service returned an invalid session.");
  }

  const candidate = value as Partial<VoiceSession> & {
    workerUrl?: unknown;
    sessionId?: unknown;
    capabilityToken?: unknown;
  };
  // Accept the session endpoint's explicit security vocabulary while retaining
  // the host/name/token shape used directly by the Cloudflare client.
  const host = typeof candidate.host === "string" ? candidate.host : candidate.workerUrl;
  const name = typeof candidate.name === "string" ? candidate.name : candidate.sessionId;
  const token = typeof candidate.token === "string" ? candidate.token : candidate.capabilityToken;
  if (
    typeof host !== "string" ||
    typeof name !== "string" ||
    typeof token !== "string" ||
    !host ||
    !name ||
    !token
  ) {
    throw new Error("The voice session is missing connection details.");
  }

  if (candidate.locale !== undefined && !VOICE_LANGUAGES.some((language) => language.locale === candidate.locale)) {
    throw new Error("The voice session returned an unsupported language.");
  }
  return {
    host: normalizeHost(host),
    name,
    token,
    agent: candidate.agent,
    locale: (candidate.locale as VoiceLocale | undefined) ?? "en-IN",
  };
}

export default function PatientVoiceAgent() {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<VoiceLocale>("en-IN");
  const [startRequested, setStartRequested] = useState(false);
  const [noiseMode, setNoiseMode] = useState<"standard" | "noisy">("standard");
  const [browserSpeaking, setBrowserSpeaking] = useState(false);
  const [deviceVoiceAvailable, setDeviceVoiceAvailable] = useState<boolean | null>(null);
  // Per-language device-voice availability (null = voices not loaded yet).
  // Languages without a device voice still work for transcript + typed input;
  // only spoken replies need an installed voice.
  const [voiceSupport, setVoiceSupport] = useState<Record<string, boolean> | null>(null);
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [reconnectNotice, setReconnectNotice] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const spokenMessageIdsRef = useRef(new Set<string>());
  const browserInterruptChunksRef = useRef(0);

  const loadSession = useCallback(async (locale: VoiceLocale, startAfterConnect = false) => {
    setIsLoadingSession(true);
    setSessionError(null);
    setLocalError(null);

    try {
      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Could not create a secure voice session.";
        throw new Error(message);
      }

      setSession(getSession(payload));
      setStartRequested(startAfterConnect);
    } catch (error) {
      setSession(null);
      setSessionError(
        error instanceof Error ? error.message : "Could not connect to the voice service.",
      );
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/settings", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setSelectedLocale(voiceLocaleForPreference(data?.preferences?.locale)))
      .catch(() => undefined);
  }, []);

  const {
    status,
    transcript,
    interimTranscript,
    audioLevel,
    isMuted,
    connected,
    error,
    outputDeviceError,
    startCall,
    endCall,
    toggleMute,
    sendText,
    sendJSON,
    lastCustomMessage,
  } = useVoiceAgent({
    agent: session?.agent || "PatientVoiceAgent",
    name: session?.name || "pending",
    host: session?.host,
    query: session ? { token: session.token } : undefined,
    enabled: Boolean(session),
    silenceThreshold: noiseMode === "noisy" ? 0.065 : 0.035,
    silenceDurationMs: noiseMode === "noisy" ? 700 : 560,
    interruptThreshold: noiseMode === "noisy" ? 0.085 : 0.045,
    interruptChunks: noiseMode === "noisy" ? 4 : 3,
    onReconnect: () => {
      setReconnectNotice(true);
      window.setTimeout(() => setReconnectNotice(false), 3500);
    },
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [transcript, interimTranscript]);

  useEffect(() => {
    if (!startRequested || !connected || !session) return;
    setStartRequested(false);
    void startCall().catch((callError: unknown) => {
      const message = callError instanceof Error ? callError.message : "Microphone access failed.";
      const denied = /permission|denied|notallowed/i.test(message);
      setLocalError(
        denied
          ? "Microphone access is blocked. Allow microphone access in your browser settings, then try again."
          : message,
      );
    });
  }, [connected, session, startCall, startRequested]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setDeviceVoiceAvailable(false);
      setVoiceSupport(Object.fromEntries(VOICE_LANGUAGES.map((language) => [language.locale, false])));
      return;
    }
    const updateAvailability = () => {
      const voices = window.speechSynthesis.getVoices().map((voice) => voice.lang.toLowerCase());
      if (!voices.length) {
        setDeviceVoiceAvailable(null);
        setVoiceSupport(null);
        return;
      }
      const support = Object.fromEntries(
        VOICE_LANGUAGES.map((language) => {
          const locale = language.locale.toLowerCase();
          const base = locale.split("-")[0];
          return [language.locale, voices.some((voice) => voice === locale || voice.split("-")[0] === base)];
        }),
      );
      setVoiceSupport(support);
      setDeviceVoiceAvailable(support[selectedLocale] ?? false);
    };
    updateAvailability();
    window.speechSynthesis.addEventListener("voiceschanged", updateAvailability);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", updateAvailability);
  }, [selectedLocale]);

  useEffect(() => {
    if (!lastCustomMessage || typeof lastCustomMessage !== "object") return;
    const message = lastCustomMessage as Record<string, unknown>;
    if (
      message.type !== "browser_tts" ||
      typeof message.id !== "string" ||
      typeof message.text !== "string" ||
      message.locale !== selectedLocale ||
      spokenMessageIdsRef.current.has(message.id)
    ) return;
    spokenMessageIdsRef.current.add(message.id);
    if (spokenMessageIdsRef.current.size > 200) spokenMessageIdsRef.current.clear();
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setLocalError("This device does not provide speech output. You can continue using the visible transcript and typed input.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message.text.slice(0, 3_500));
    utterance.lang = selectedLocale;
    utterance.rate = 1.02;
    const language = selectedLocale.toLowerCase().split("-")[0];
    utterance.voice = window.speechSynthesis.getVoices().find((voice) =>
      voice.lang.toLowerCase() === selectedLocale.toLowerCase(),
    ) ?? window.speechSynthesis.getVoices().find((voice) =>
      voice.lang.toLowerCase().split("-")[0] === language,
    ) ?? null;
    utterance.onstart = () => setBrowserSpeaking(true);
    utterance.onend = () => setBrowserSpeaking(false);
    utterance.onerror = () => setBrowserSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [lastCustomMessage, selectedLocale]);

  useEffect(() => {
    if (!browserSpeaking) {
      browserInterruptChunksRef.current = 0;
      return;
    }
    const threshold = noiseMode === "noisy" ? 0.085 : 0.045;
    browserInterruptChunksRef.current = audioLevel > threshold
      ? browserInterruptChunksRef.current + 1
      : 0;
    if (browserInterruptChunksRef.current < (noiseMode === "noisy" ? 4 : 3)) return;
    browserInterruptChunksRef.current = 0;
    window.speechSynthesis.cancel();
    setBrowserSpeaking(false);
    sendJSON({ type: "interrupt" });
  }, [audioLevel, browserSpeaking, noiseMode, sendJSON]);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const beginCall = async () => {
    setLocalError(null);
    if (!session) {
      await loadSession(selectedLocale, true);
      return;
    }
    try {
      await startCall();
    } catch (callError) {
      const message = callError instanceof Error ? callError.message : "Microphone access failed.";
      const denied = /permission|denied|notallowed/i.test(message);
      setLocalError(
        denied
          ? "Microphone access is blocked. Allow microphone access in your browser settings, then try again."
          : message,
      );
    }
  };

  const finishCall = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setBrowserSpeaking(false);
    endCall();
    setSession(null);
    setStartRequested(false);
  };

  const submitText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextText = text.trim();
    if (!nextText || !connected) return;
    sendText(nextText);
    setText("");
  };

  const effectiveStatus: VoiceStatus = browserSpeaking ? "speaking" : status;
  const active = effectiveStatus !== "idle";
  const currentState = stateCopy[effectiveStatus];
  const displayError = localError || error || outputDeviceError || sessionError;
  const selectedLanguage = VOICE_LANGUAGES.find((language) => language.locale === selectedLocale) ?? VOICE_LANGUAGES[0];

  return (
    <section className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8" aria-labelledby="voice-agent-title">
      <div className="overflow-hidden rounded-[2rem] border border-teal-200/70 bg-white shadow-[0_28px_90px_-45px_rgba(13,148,136,0.45)]">
        <header className="border-b border-teal-100 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.2),_transparent_42%),linear-gradient(135deg,#fff_0%,#f0fdfa_48%,#ecfdf5_100%)] px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Patient context · voice channel
              </div>
              <h1 id="voice-agent-title" className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Talk through your health record
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Ask about your reports, lab trends, medications, or upcoming visits. The AI uses the health information saved to your signed-in MediClarity account.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <Languages className="h-4 w-4 text-teal-700" aria-hidden="true" />
                Spoken language
                <span
                  className={`h-2 w-2 rounded-full ${deviceVoiceAvailable === null ? "bg-slate-300" : deviceVoiceAvailable ? "bg-emerald-500" : "bg-rose-500"}`}
                  title={deviceVoiceAvailable === null ? "Checking installed device voices…" : deviceVoiceAvailable ? "A device voice is installed for this language" : "No device voice installed — transcript still works"}
                  aria-hidden="true"
                />
                <select
                  value={selectedLocale}
                  onChange={(event) => {
                    setSelectedLocale(event.target.value as VoiceLocale);
                    setSession(null);
                    setSessionError(null);
                  }}
                  disabled={active || isLoadingSession}
                  className="rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-300 disabled:opacity-60"
                >
                  {VOICE_LANGUAGES.map((language) => (
                    <option key={language.locale} value={language.locale}>
                      {language.label} · {language.nativeLabel}{voiceSupport && !voiceSupport[language.locale] ? " · no device voice" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <Wind className="h-4 w-4 text-teal-700" aria-hidden="true" />
                Room noise
                <select
                  value={noiseMode}
                  onChange={(event) => setNoiseMode(event.target.value as "standard" | "noisy")}
                  disabled={active || isLoadingSession}
                  className="rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-300 disabled:opacity-60"
                >
                  <option value="standard">Standard</option>
                  <option value="noisy">Noisy room</option>
                </select>
              </label>
              <div className="flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-2 font-mono text-[11px] text-slate-600 shadow-sm">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
                {connected ? `Connected · ${selectedLanguage.label}` : "Private until you start"}
              </div>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <div className="relative flex min-h-[500px] flex-col items-center justify-center overflow-hidden border-b border-teal-100 px-5 py-10 lg:border-b-0 lg:border-r sm:px-8">
            <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(20,184,166,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(20,184,166,0.06)_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden="true" />

            <div className="relative flex flex-col items-center text-center">
              <div
                className={`relative grid h-52 w-52 place-items-center rounded-full border sm:h-60 sm:w-60 ${
                  active ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-slate-50"
                }`}
                aria-label={`${currentState.label}. Microphone level ${Math.round(audioLevel * 100)} percent.`}
              >
                {active && (
                  <span className="absolute inset-3 rounded-full border border-teal-300/70 motion-safe:animate-ping" aria-hidden="true" />
                )}
                <div className="relative flex h-28 w-28 items-center justify-center gap-1 rounded-full bg-[#102c2a] px-5 shadow-xl shadow-teal-300/40 sm:h-32 sm:w-32">
                  {waveform.map((scale, index) => {
                    const liveHeight = active ? Math.max(18, 28 + audioLevel * 60 * scale) : 18 + scale * 16;
                    return (
                      <span
                        key={index}
                        className={`w-1 rounded-full bg-gradient-to-t from-teal-700 to-teal-300 transition-[height] duration-100 motion-reduce:transition-none ${
                          effectiveStatus === "thinking" ? "motion-safe:animate-pulse" : ""
                        }`}
                        style={{ height: `${liveHeight}px`, transitionDelay: `${index * 16}ms` }}
                        aria-hidden="true"
                      />
                    );
                  })}
                </div>
                <span className="absolute bottom-4 rounded-full bg-white px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-teal-800 shadow-sm">
                  {effectiveStatus}
                </span>
              </div>

              <h2 className="mt-7 text-xl font-semibold text-slate-950" aria-live="polite">{currentState.label}</h2>
              <p className="mt-1 min-h-10 max-w-sm text-sm leading-5 text-slate-500">{currentState.detail}</p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {!active ? (
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-teal-700 px-6 text-white shadow-lg shadow-teal-200 hover:bg-teal-800"
                    onClick={() => void beginCall()}
                    disabled={isLoadingSession || startRequested}
                  >
                    {isLoadingSession ? <LoaderCircle className="animate-spin" /> : <Mic />}
                    {isLoadingSession || startRequested ? "Preparing private session" : "Start voice conversation"}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-full border-slate-300 px-5"
                      onClick={toggleMute}
                      aria-pressed={isMuted}
                    >
                      {isMuted ? <MicOff /> : <Mic />}
                      {isMuted ? "Unmute" : "Mute"}
                    </Button>
                    <Button
                      size="lg"
                      className="h-12 rounded-full bg-[#102c2a] px-5 text-white hover:bg-[#0b766e]"
                      onClick={finishCall}
                    >
                      <CircleStop /> End session
                    </Button>
                  </>
                )}
              </div>

              {isMuted && active && (
                <p className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-700" role="status">
                  <MicOff className="h-4 w-4" /> Your microphone is muted
                </p>
              )}
              {!active && (
                <p className="mt-5 max-w-md text-xs leading-5 text-slate-500">
                  Starting sends a bounded snapshot of your saved health record to Cloudflare for this conversation. Speech output uses a voice installed by your browser or device, with no additional paid speech key. Browser echo cancellation, noise suppression, and automatic gain control are enabled when supported.
                </p>
              )}
              {deviceVoiceAvailable === false && (
                <p className="mt-3 max-w-md text-xs leading-5 text-amber-700" role="status">
                  This device has no {selectedLanguage.label} voice installed. The transcript still works; install that language in your device speech settings for spoken replies.
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-[500px] flex-col bg-slate-50/70">
            <div className="flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">Conversation</h2>
                <p className="text-xs text-slate-500">Voice and typed questions appear here.</p>
              </div>
              <Volume2 className={`h-5 w-5 ${effectiveStatus === "speaking" ? "text-teal-700" : "text-slate-300"}`} aria-hidden="true" />
            </div>

            <ScrollArea className="h-[340px] flex-1 px-5 py-5" aria-label="Voice agent transcript" role="log" aria-live="polite">
              {transcript.length === 0 && !interimTranscript ? (
                <div className="grid h-full min-h-56 place-items-center text-center">
                  <div className="max-w-xs">
                    <Bot className="mx-auto h-8 w-8 text-teal-400" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-slate-700">No messages yet</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Try “Explain my latest lab results in simple language.”</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {transcript.map((message, index) => {
                    const fromPatient = message.role === "user";
                    return (
                      <div key={`${message.timestamp}-${index}`} className={`flex ${fromPatient ? "justify-end" : "justify-start"}`}>
                        <div lang={selectedLocale} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                          fromPatient
                            ? "rounded-br-sm bg-teal-700 text-white"
                            : "rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"
                        }`}>
                          <p className={`mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest ${fromPatient ? "text-teal-100" : "text-teal-700"}`}>
                            {fromPatient ? "You" : "MediClarity AI"}
                          </p>
                          {message.text}
                        </div>
                      </div>
                    );
                  })}
                  {interimTranscript && (
                    <div className="flex justify-end" aria-live="off">
                      <div className="max-w-[88%] rounded-2xl rounded-br-sm border border-dashed border-teal-300 bg-teal-50 px-4 py-3 text-sm italic text-teal-900">
                        <p className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-teal-700">Hearing now</p>
                        {interimTranscript}
                      </div>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </ScrollArea>

            <form onSubmit={submitText} className="border-t bg-white p-4">
              <label htmlFor="voice-text-fallback" className="sr-only">Type a question for the voice assistant</label>
              <div className="flex gap-2">
                <input
                  id="voice-text-fallback"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={connected ? "Type instead of speaking…" : "Connect to type a question"}
                  disabled={!connected}
                  maxLength={1_000}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200 disabled:bg-slate-100"
                />
                <Button type="submit" size="icon" className="rounded-xl bg-teal-700 hover:bg-teal-800" disabled={!connected || !text.trim()} aria-label="Send typed question">
                  <Send />
                </Button>
              </div>
            </form>
          </div>
        </div>

        {(displayError || reconnectNotice) && (
          <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm ${displayError ? "border-rose-200 bg-rose-50 text-rose-900" : "border-sky-200 bg-sky-50 text-sky-900"}`} role="status">
            <span className="flex items-center gap-2">
              {displayError ? <AlertCircle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              {displayError || "The secure voice channel reconnected."}
            </span>
            {displayError && (
              <Button type="button" size="sm" variant="outline" className="bg-white" onClick={() => void loadSession(selectedLocale)}>
                <RefreshCw /> Try again
              </Button>
            )}
          </div>
        )}

        <footer className="grid gap-3 border-t border-teal-100 bg-white px-5 py-5 sm:grid-cols-2 sm:px-8">
          <div className="flex gap-3 rounded-xl bg-teal-50 p-3 text-xs leading-5 text-teal-950">
            <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
            <p><strong>AI health-information assistant.</strong> It may make mistakes and does not replace a doctor, diagnosis, or medical advice.</p>
          </div>
          <div className="flex gap-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-950">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
            <p><strong>Not for emergencies.</strong> If you may be in immediate danger, call your local emergency services now.</p>
          </div>
        </footer>
      </div>
    </section>
  );
}
