"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useVoiceAgent, type VoiceStatus } from "@cloudflare/voice/react";
import {
  AlertCircle,
  Bot,
  CircleStop,
  HeartPulse,
  LoaderCircle,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type VoiceSession = {
  host: string;
  name: string;
  token: string;
  agent?: string;
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

  return {
    host: normalizeHost(host),
    name,
    token,
    agent: candidate.agent,
  };
}

export default function PatientVoiceAgent() {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [reconnectNotice, setReconnectNotice] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const loadSession = useCallback(async () => {
    setIsLoadingSession(true);
    setSessionError(null);
    setLocalError(null);

    try {
      const response = await fetch("/api/voice/session", {
        method: "POST",
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
    void loadSession();
  }, [loadSession]);

  const {
    status,
    transcript,
    interimTranscript,
    audioLevel,
    isMuted,
    connected,
    error,
    startCall,
    endCall,
    toggleMute,
    sendText,
  } = useVoiceAgent({
    agent: session?.agent || "PatientVoiceAgent",
    name: session?.name || "pending",
    host: session?.host,
    query: session ? { token: session.token } : undefined,
    enabled: Boolean(session),
    silenceDurationMs: 650,
    interruptThreshold: 0.05,
    interruptChunks: 2,
    onReconnect: () => {
      setReconnectNotice(true);
      window.setTimeout(() => setReconnectNotice(false), 3500);
    },
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [transcript, interimTranscript]);

  const beginCall = async () => {
    setLocalError(null);
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

  const submitText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextText = text.trim();
    if (!nextText || !connected) return;
    sendText(nextText);
    setText("");
  };

  const active = status !== "idle";
  const currentState = stateCopy[status];
  const displayError = localError || error || sessionError;

  return (
    <section className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8" aria-labelledby="voice-agent-title">
      <div className="overflow-hidden rounded-[2rem] border border-fuchsia-200/70 bg-white shadow-[0_28px_90px_-45px_rgba(192,38,211,0.45)]">
        <header className="border-b border-fuchsia-100 bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.2),_transparent_42%),linear-gradient(135deg,#fff_0%,#fdf4ff_48%,#fff7fb_100%)] px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-700">
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
            <div className="flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white/80 px-3 py-2 font-mono text-[11px] text-slate-600 shadow-sm">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
              {connected ? "Secure channel connected" : "Secure channel offline"}
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <div className="relative flex min-h-[500px] flex-col items-center justify-center overflow-hidden border-b border-fuchsia-100 px-5 py-10 lg:border-b-0 lg:border-r sm:px-8">
            <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(217,70,239,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(217,70,239,0.06)_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden="true" />

            <div className="relative flex flex-col items-center text-center">
              <div
                className={`relative grid h-52 w-52 place-items-center rounded-full border sm:h-60 sm:w-60 ${
                  active ? "border-fuchsia-300 bg-fuchsia-50" : "border-slate-200 bg-slate-50"
                }`}
                aria-label={`${currentState.label}. Microphone level ${Math.round(audioLevel * 100)} percent.`}
              >
                {active && (
                  <span className="absolute inset-3 rounded-full border border-fuchsia-300/70 motion-safe:animate-ping" aria-hidden="true" />
                )}
                <div className="relative flex h-28 w-28 items-center justify-center gap-1 rounded-full bg-slate-950 px-5 shadow-xl shadow-fuchsia-300/40 sm:h-32 sm:w-32">
                  {waveform.map((scale, index) => {
                    const liveHeight = active ? Math.max(18, 28 + audioLevel * 60 * scale) : 18 + scale * 16;
                    return (
                      <span
                        key={index}
                        className={`w-1 rounded-full bg-gradient-to-t from-fuchsia-600 to-pink-300 transition-[height] duration-100 motion-reduce:transition-none ${
                          status === "thinking" ? "motion-safe:animate-pulse" : ""
                        }`}
                        style={{ height: `${liveHeight}px`, transitionDelay: `${index * 16}ms` }}
                        aria-hidden="true"
                      />
                    );
                  })}
                </div>
                <span className="absolute bottom-4 rounded-full bg-white px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-fuchsia-800 shadow-sm">
                  {status}
                </span>
              </div>

              <h2 className="mt-7 text-xl font-semibold text-slate-950" aria-live="polite">{currentState.label}</h2>
              <p className="mt-1 min-h-10 max-w-sm text-sm leading-5 text-slate-500">{currentState.detail}</p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {!active ? (
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-fuchsia-700 px-6 text-white shadow-lg shadow-fuchsia-200 hover:bg-fuchsia-800"
                    onClick={() => void beginCall()}
                    disabled={!connected || isLoadingSession}
                  >
                    {isLoadingSession ? <LoaderCircle className="animate-spin" /> : <Mic />}
                    {isLoadingSession ? "Preparing session" : "Start voice session"}
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
                      className="h-12 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
                      onClick={endCall}
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
            </div>
          </div>

          <div className="flex min-h-[500px] flex-col bg-slate-50/70">
            <div className="flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">Conversation</h2>
                <p className="text-xs text-slate-500">Voice and typed questions appear here.</p>
              </div>
              <Volume2 className={`h-5 w-5 ${status === "speaking" ? "text-fuchsia-700" : "text-slate-300"}`} aria-hidden="true" />
            </div>

            <ScrollArea className="h-[340px] flex-1 px-5 py-5" aria-label="Voice agent transcript">
              {transcript.length === 0 && !interimTranscript ? (
                <div className="grid h-full min-h-56 place-items-center text-center">
                  <div className="max-w-xs">
                    <Bot className="mx-auto h-8 w-8 text-fuchsia-400" aria-hidden="true" />
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
                        <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                          fromPatient
                            ? "rounded-br-sm bg-fuchsia-700 text-white"
                            : "rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"
                        }`}>
                          <p className={`mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest ${fromPatient ? "text-fuchsia-100" : "text-fuchsia-700"}`}>
                            {fromPatient ? "You" : "MediClarity AI"}
                          </p>
                          {message.text}
                        </div>
                      </div>
                    );
                  })}
                  {interimTranscript && (
                    <div className="flex justify-end" aria-live="polite">
                      <div className="max-w-[88%] rounded-2xl rounded-br-sm border border-dashed border-fuchsia-300 bg-fuchsia-50 px-4 py-3 text-sm italic text-fuchsia-900">
                        <p className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-fuchsia-600">Hearing now</p>
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
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-200 disabled:bg-slate-100"
                />
                <Button type="submit" size="icon" className="rounded-xl bg-fuchsia-700 hover:bg-fuchsia-800" disabled={!connected || !text.trim()} aria-label="Send typed question">
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
              <Button type="button" size="sm" variant="outline" className="bg-white" onClick={() => void loadSession()}>
                <RefreshCw /> Try again
              </Button>
            )}
          </div>
        )}

        <footer className="grid gap-3 border-t border-fuchsia-100 bg-white px-5 py-5 sm:grid-cols-2 sm:px-8">
          <div className="flex gap-3 rounded-xl bg-fuchsia-50 p-3 text-xs leading-5 text-fuchsia-950">
            <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-700" aria-hidden="true" />
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
