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
  Volume2,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  VOICE_LANGUAGES,
  type VoiceLocale,
  voiceLocaleForPreference,
} from "@/config/voice-languages";
import { speechWatchdogMs } from "@/lib/speech-timing";

type VoiceSession = {
  host: string;
  name: string;
  token: string;
  expiresAt: number;
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
    expiresAt?: unknown;
  };
  // Accept the session endpoint's explicit security vocabulary while retaining
  // the host/name/token shape used directly by the Cloudflare client.
  const host = typeof candidate.host === "string" ? candidate.host : candidate.workerUrl;
  const name = typeof candidate.name === "string" ? candidate.name : candidate.sessionId;
  const token = typeof candidate.token === "string" ? candidate.token : candidate.capabilityToken;
  const expiresAt = typeof candidate.expiresAt === "string"
    ? Date.parse(candidate.expiresAt)
    : Number.NaN;
  if (
    typeof host !== "string" ||
    typeof name !== "string" ||
    typeof token !== "string" ||
    !host ||
    !name ||
    !token ||
    !Number.isFinite(expiresAt)
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
    expiresAt,
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
  const isMutedRef = useRef(false);
  const mutedForTtsRef = useRef(false);
  const toggleMuteRef = useRef<() => void>(() => undefined);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsWatchdogRef = useRef<number | null>(null);
  const speakingPollRef = useRef<number | null>(null);
  const renewedSessionRef = useRef<string | null>(null);

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
    silenceThreshold: noiseMode === "noisy" ? 0.08 : 0.05,
    silenceDurationMs: noiseMode === "noisy" ? 900 : 700,
    interruptThreshold: noiseMode === "noisy" ? 0.18 : 0.14,
    interruptChunks: noiseMode === "noisy" ? 8 : 6,
    onReconnect: () => {
      setReconnectNotice(true);
      window.setTimeout(() => setReconnectNotice(false), 3500);
    },
  });

  useEffect(() => {
    if (!session || connected) return;

    // PartySocket reconnects with its original query string. Once the short-lived
    // capability expires, a Worker restart would otherwise retry that credential
    // forever and produce a stream of 401 responses.
    const renew = () => {
      if (renewedSessionRef.current === session.name) return;
      renewedSessionRef.current = session.name;
      const resumeCall = startRequested || status !== "idle";
      void loadSession(selectedLocale, resumeCall);
    };
    const delay = Math.max(0, session.expiresAt - Date.now() + 1_000);
    const timeout = window.setTimeout(renew, delay);
    return () => window.clearTimeout(timeout);
  }, [connected, loadSession, selectedLocale, session, startRequested, status]);

  isMutedRef.current = isMuted;
  toggleMuteRef.current = toggleMute;

  const clearTtsTimers = useCallback(() => {
    if (ttsWatchdogRef.current !== null) {
      window.clearTimeout(ttsWatchdogRef.current);
      ttsWatchdogRef.current = null;
    }
    if (speakingPollRef.current !== null) {
      window.clearInterval(speakingPollRef.current);
      speakingPollRef.current = null;
    }
  }, []);

  const releaseTtsMute = useCallback(() => {
    clearTtsTimers();
    setBrowserSpeaking(false);
    if (!mutedForTtsRef.current) return;
    mutedForTtsRef.current = false;
    if (isMutedRef.current) toggleMuteRef.current();
  }, [clearTtsTimers]);

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
    const spoken = message.text.slice(0, 6_000);
    window.speechSynthesis.cancel();
    clearTtsTimers();
    const utterance = new SpeechSynthesisUtterance(spoken);
    utteranceRef.current = utterance;
    utterance.lang = selectedLocale;
    utterance.rate = 1.02;
    const language = selectedLocale.toLowerCase().split("-")[0];
    utterance.voice = window.speechSynthesis.getVoices().find((voice) =>
      voice.lang.toLowerCase() === selectedLocale.toLowerCase(),
    ) ?? window.speechSynthesis.getVoices().find((voice) =>
      voice.lang.toLowerCase().split("-")[0] === language,
    ) ?? null;
    utterance.onstart = () => {
      setBrowserSpeaking(true);
      if (!mutedForTtsRef.current && !isMutedRef.current) {
        mutedForTtsRef.current = true;
        toggleMuteRef.current();
      }
      if (speakingPollRef.current !== null) window.clearInterval(speakingPollRef.current);
      speakingPollRef.current = window.setInterval(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) releaseTtsMute();
      }, 400);
    };
    utterance.onend = () => releaseTtsMute();
    utterance.onerror = () => releaseTtsMute();
    window.speechSynthesis.speak(utterance);
    ttsWatchdogRef.current = window.setTimeout(() => {
      window.speechSynthesis.cancel();
      releaseTtsMute();
    }, speechWatchdogMs(spoken));
  }, [clearTtsTimers, lastCustomMessage, releaseTtsMute, selectedLocale]);

  useEffect(() => {
    if (!browserSpeaking || mutedForTtsRef.current || isMuted) {
      browserInterruptChunksRef.current = 0;
      return;
    }
    const threshold = noiseMode === "noisy" ? 0.2 : 0.16;
    browserInterruptChunksRef.current = audioLevel > threshold
      ? browserInterruptChunksRef.current + 1
      : 0;
    if (browserInterruptChunksRef.current < (noiseMode === "noisy" ? 8 : 6)) return;
    browserInterruptChunksRef.current = 0;
    window.speechSynthesis.cancel();
    releaseTtsMute();
    sendJSON({ type: "interrupt" });
  }, [audioLevel, browserSpeaking, isMuted, noiseMode, releaseTtsMute, sendJSON]);

  useEffect(() => () => {
    clearTtsTimers();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [clearTtsTimers]);

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
    releaseTtsMute();
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
    <section className="mx-auto h-full w-full max-w-[1500px] p-2 sm:p-3 lg:p-4" aria-labelledby="voice-agent-title">
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden rounded-xl border border-slate-300 bg-white">
        <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">
                Secure patient voice
              </div>
              <h1 id="voice-agent-title" className="truncate text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                Talk through your health record
              </h1>
              <p className="mt-1 hidden text-xs text-slate-500 lg:block">
                Ask about saved reports, lab trends, medications, or upcoming visits.
              </p>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-initial">
              <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-700">
                <Languages className="hidden h-4 w-4 text-teal-700 sm:block" aria-hidden="true" />
                <span className="sr-only">Spoken language</span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${deviceVoiceAvailable === null ? "bg-slate-300" : deviceVoiceAvailable ? "bg-emerald-500" : "bg-rose-500"}`}
                  title={deviceVoiceAvailable === null ? "Checking installed device voices…" : deviceVoiceAvailable ? "A device voice is installed for this language" : "No device voice installed — transcript still works"}
                  aria-hidden="true"
                />
                <Select
                  value={selectedLocale}
                  onValueChange={(value) => {
                    setSelectedLocale(value as VoiceLocale);
                    setSession(null);
                    setSessionError(null);
                  }}
                  disabled={active || isLoadingSession}
                >
                  <SelectTrigger aria-label="Spoken language" size="sm" className="w-[9.5rem] border-slate-300 bg-white sm:w-[13rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_LANGUAGES.map((language) => (
                      <SelectItem key={language.locale} value={language.locale}>
                        {language.label} · {language.nativeLabel}{voiceSupport && !voiceSupport[language.locale] ? " · no device voice" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <Wind className="hidden h-4 w-4 text-slate-500 sm:block" aria-hidden="true" />
                <span className="sr-only">Room noise</span>
                <Select
                  value={noiseMode}
                  onValueChange={(value) => setNoiseMode(value as "standard" | "noisy")}
                  disabled={active || isLoadingSession}
                >
                  <SelectTrigger aria-label="Room noise" size="sm" className="w-[6.5rem] border-slate-300 bg-white sm:w-[8.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="noisy">Noisy room</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 font-mono text-[10px] uppercase tracking-wide text-slate-500 xl:flex">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
                {connected ? "Connected" : "Not connected"}
              </div>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 grid-rows-[minmax(190px,0.8fr)_minmax(170px,1.2fr)] md:grid-cols-[minmax(280px,0.82fr)_minmax(360px,1.18fr)] md:grid-rows-1">
          <div className="flex min-h-0 flex-col items-center justify-center overflow-hidden border-b border-slate-200 bg-slate-50 px-4 py-3 md:border-b-0 md:border-r sm:px-6">
            <div className="flex flex-col items-center text-center">
              <div
                className={`relative grid h-28 w-28 place-items-center rounded-full border sm:h-32 sm:w-32 lg:h-40 lg:w-40 ${
                  active ? "border-teal-500 bg-white" : "border-slate-300 bg-white"
                }`}
                aria-label={`${currentState.label}. Microphone level ${Math.round(audioLevel * 100)} percent.`}
              >
                <div className="relative flex h-16 w-16 items-center justify-center gap-0.5 rounded-full bg-[#173b38] px-3 sm:h-20 sm:w-20 sm:gap-1 sm:px-4 lg:h-24 lg:w-24">
                  {waveform.map((scale, index) => {
                    const liveHeight = active ? Math.max(10, 14 + audioLevel * 38 * scale) : 10 + scale * 12;
                    return (
                      <span
                        key={index}
                        className={`w-0.5 rounded-full bg-teal-200 transition-[height] duration-100 motion-reduce:transition-none sm:w-1 ${
                          effectiveStatus === "thinking" ? "motion-safe:animate-pulse" : ""
                        }`}
                        style={{ height: `${liveHeight}px`, transitionDelay: `${index * 16}ms` }}
                        aria-hidden="true"
                      />
                    );
                  })}
                </div>
                <span className="absolute -bottom-3 border border-slate-300 bg-white px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-teal-800">
                  {effectiveStatus}
                </span>
              </div>

              <h2 className="mt-5 text-base font-semibold text-slate-950 sm:text-lg" aria-live="polite">{currentState.label}</h2>
              <p className="mt-0.5 hidden max-w-sm text-xs leading-5 text-slate-500 sm:block">{currentState.detail}</p>

              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:mt-4">
                {!active ? (
                  <Button
                    className="h-10 rounded-md bg-[#173b38] px-5 text-white hover:bg-[#245b56]"
                    onClick={() => void beginCall()}
                    disabled={isLoadingSession || startRequested}
                  >
                    {isLoadingSession ? <LoaderCircle className="animate-spin" /> : <Mic />}
                    {isLoadingSession || startRequested ? "Preparing private session" : "Start voice conversation"}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="h-10 rounded-md border-slate-300 px-4"
                      onClick={toggleMute}
                      aria-pressed={isMuted}
                    >
                      {isMuted ? <MicOff /> : <Mic />}
                      {isMuted ? "Unmute" : "Mute"}
                    </Button>
                    <Button
                      className="h-10 rounded-md bg-[#173b38] px-4 text-white hover:bg-[#245b56]"
                      onClick={finishCall}
                    >
                      <CircleStop /> End session
                    </Button>
                  </>
                )}
              </div>

              {isMuted && active && (
                <p className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-700" role="status">
                  <MicOff className="h-4 w-4" /> Your microphone is muted
                </p>
              )}
              {deviceVoiceAvailable === false && (
                <p className="mt-2 max-w-sm text-[11px] leading-4 text-amber-700" role="status">
                  No {selectedLanguage.label} device voice is installed. The transcript still works.
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Conversation</h2>
                <p className="hidden text-[11px] text-slate-500 sm:block">Voice and typed questions appear here.</p>
              </div>
              <Volume2 className={`h-4 w-4 ${effectiveStatus === "speaking" ? "text-teal-700" : "text-slate-300"}`} aria-hidden="true" />
            </div>

            <ScrollArea className="min-h-0 flex-1 px-4 py-3 sm:px-5" aria-label="Voice agent transcript" role="log" aria-live="polite">
              {transcript.length === 0 && !interimTranscript ? (
                <div className="grid h-full min-h-28 place-items-center text-center">
                  <div className="max-w-xs">
                    <Bot className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium text-slate-700">No messages yet</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Try “Explain my latest lab results simply.”</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {transcript.map((message, index) => {
                    const fromPatient = message.role === "user";
                    return (
                      <div key={`${message.timestamp}-${index}`} className={`flex ${fromPatient ? "justify-end" : "justify-start"}`}>
                        <div lang={selectedLocale} className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-5 ${
                          fromPatient
                            ? "rounded-br-sm bg-[#245b56] text-white"
                            : "rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-700"
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
                      <div className="max-w-[88%] rounded-lg rounded-br-sm border border-dashed border-teal-400 bg-teal-50 px-3 py-2 text-sm italic text-teal-900">
                        <p className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-teal-700">Hearing now</p>
                        {interimTranscript}
                      </div>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </ScrollArea>

            <form onSubmit={submitText} className="border-t border-slate-200 bg-slate-50 p-3">
              <label htmlFor="voice-text-fallback" className="sr-only">Type a question for the voice assistant</label>
              <div className="flex gap-2">
                <input
                  id="voice-text-fallback"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={connected ? "Type instead of speaking…" : "Connect to type a question"}
                  disabled={!connected}
                  maxLength={1_000}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                />
                <Button type="submit" size="icon" className="rounded-md bg-[#173b38] hover:bg-[#245b56]" disabled={!connected || !text.trim()} aria-label="Send typed question">
                  <Send />
                </Button>
              </div>
            </form>
          </div>
        </div>

        {(displayError || reconnectNotice) && (
          <div className={`flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs ${displayError ? "border-rose-200 bg-rose-50 text-rose-900" : "border-sky-200 bg-sky-50 text-sky-900"}`} role="status">
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

        <footer className="grid grid-cols-2 border-t border-slate-200 bg-slate-50 text-[10px] leading-4 text-slate-600 sm:text-[11px]">
          <div className="flex gap-2 border-r border-slate-200 px-3 py-2 sm:px-4">
            <HeartPulse className="mt-0.5 hidden h-3.5 w-3.5 shrink-0 text-teal-700 sm:block" aria-hidden="true" />
            <p><strong className="text-slate-800">Information only.</strong> This AI does not replace a doctor or diagnosis.</p>
          </div>
          <div className="flex gap-2 px-3 py-2 sm:px-4">
            <ShieldAlert className="mt-0.5 hidden h-3.5 w-3.5 shrink-0 text-rose-700 sm:block" aria-hidden="true" />
            <p><strong className="text-slate-800">Not for emergencies.</strong> Call local emergency services for immediate danger.</p>
          </div>
        </footer>
      </div>
    </section>
  );
}
