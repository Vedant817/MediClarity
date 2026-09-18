import { Agent, getAgentByName, routeAgentRequest, type Connection } from "agents";
import { withVoice, type VoiceTurnContext } from "@cloudflare/voice";
import { streamText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { agentInstanceName, connectionTokenFromRequest, verifyConnectionToken } from "./auth";
import { fetchPatientContext, type PatientContext } from "./patient-context";
import { buildClinicalSystemPrompt } from "./prompt";
import { cleanVoiceTranscript } from "./transcript-filter";
import { greetingFor, isVoiceLocale, type VoiceLocale } from "./languages";
import { WorkersAIWhisperTranscriber } from "./workers-ai-stt";

interface AgentProps extends Record<string, unknown> {
  userId: string;
  sessionId: string;
}

interface AppEnv extends Env {
  VOICE_CAPABILITY_SECRET: string;
  VOICE_SERVICE_SECRET: string;
}

class PatientAgentBase extends Agent<AppEnv> {}

const VoiceAgent = withVoice(PatientAgentBase, { historyLimit: 24, maxMessageCount: 500 });

export class PatientVoiceAgent extends VoiceAgent {
  private patientContext: PatientContext | null = null;
  private interrupted = false;

  onStart(): void {
    this.sql`CREATE TABLE IF NOT EXISTS patient_session_context (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      context_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`;
  }

  prepareSession(identity: AgentProps, patientContext: PatientContext): void {
    if (!identity.userId || identity.sessionId !== this.name) throw new Error("invalid session identity");
    const existing = this.sql<{ user_id: string }>`SELECT user_id FROM patient_session_context WHERE singleton = 1`[0];
    if (existing && existing.user_id !== identity.userId) throw new Error("session identity cannot change");
    const serialized = JSON.stringify(patientContext);
    this.sql`INSERT INTO patient_session_context (singleton, user_id, session_id, context_json, updated_at)
      VALUES (1, ${identity.userId}, ${identity.sessionId}, ${serialized}, ${Date.now()})
      ON CONFLICT(singleton) DO UPDATE SET
        context_json = excluded.context_json,
        updated_at = excluded.updated_at`;
    this.patientContext = patientContext;
  }

  private loadPatientContext(): PatientContext | null {
    if (this.patientContext) return this.patientContext;
    const row = this.sql<{ session_id: string; context_json: string }>`
      SELECT session_id, context_json FROM patient_session_context WHERE singleton = 1
    `[0];
    if (!row || row.session_id !== this.name) return null;
    try {
      this.patientContext = JSON.parse(row.context_json) as PatientContext;
      return this.patientContext;
    } catch {
      return null;
    }
  }

  private voiceLocale(): VoiceLocale {
    const locale = this.loadPatientContext()?.preferences.locale;
    return isVoiceLocale(locale) ? locale : "en-IN";
  }

  createTranscriber(_connection: Connection) {
    return new WorkersAIWhisperTranscriber(this.env.AI, this.voiceLocale());
  }

  async beforeCallStart(_connection: Connection): Promise<boolean> {
    return this.loadPatientContext() !== null;
  }

  async onCallStart(connection: Connection): Promise<void> {
    const name = this.loadPatientContext()?.displayName;
    await this.speak(connection, greetingFor(this.voiceLocale(), name));
  }

  afterTranscribe(transcript: string): string | null {
    return cleanVoiceTranscript(transcript);
  }

  beforeSynthesize(text: string, connection: Connection): null {
    connection.send(JSON.stringify({
      type: "browser_tts",
      id: crypto.randomUUID(),
      locale: this.voiceLocale(),
      text: text.slice(0, 3_500),
    }));
    return null;
  }

  async onTurn(transcript: string, context: VoiceTurnContext) {
    const patientContext = this.loadPatientContext();
    if (!patientContext) {
      return "I can't securely load your record right now. Please try again later. If this is urgent, contact local emergency services.";
    }
    try {
      const workersAI = createWorkersAI({ binding: this.env.AI });
      const wasInterrupted = this.interrupted;
      this.interrupted = false;
      const result = streamText({
        model: workersAI("@cf/meta/llama-3.1-8b-instruct-fp8-fast"),
        system: buildClinicalSystemPrompt(patientContext, this.voiceLocale(), wasInterrupted),
        messages: [
          ...context.messages.map((message) => ({
            role: message.role as "user" | "assistant",
            content: message.content,
          })),
          { role: "user" as const, content: transcript },
        ],
        maxOutputTokens: 300,
        temperature: 0.2,
        abortSignal: context.signal,
      });
      return result.textStream;
    } catch {
      console.error("voice.turn_failed");
      return "I had trouble answering just then. Please say that again.";
    }
  }

  onInterrupt(_connection: Connection): void {
    // withVoice aborts context.signal and queued TTS before invoking this hook.
    this.interrupted = true;
    console.info("voice.turn_interrupted");
  }

  onCallEnd(_connection: Connection): void {
    this.interrupted = false;
    console.info("voice.call_ended");
  }
}

function json(body: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("cache-control", "no-store");
  return Response.json(body, {
    status,
    headers,
  });
}

function unauthorized(): Response {
  return json({ error: "unauthorized" }, 401);
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "mediclarity-voice-agent" });
    }

    const instanceName = agentInstanceName(url.pathname);
    if (!instanceName) return json({ error: "not_found" }, 404);
    const origin = request.headers.get("origin");
    if (origin !== env.ALLOWED_ORIGIN) return json({ error: "forbidden_origin" }, 403);
    const token = connectionTokenFromRequest(request);
    if (!token) return unauthorized();

    let claims;
    try {
      claims = await verifyConnectionToken(token, env.VOICE_CAPABILITY_SECRET, {
        audience: env.TOKEN_AUDIENCE,
      });
    } catch {
      return unauthorized();
    }
    if (instanceName !== claims.sid) return unauthorized();

    let patientContext: PatientContext;
    try {
      patientContext = await fetchPatientContext(env, { sessionId: claims.sid, capabilityToken: token });
      const agent = await getAgentByName(env.PatientVoiceAgent, claims.sid);
      await agent.prepareSession({ userId: claims.sub, sessionId: claims.sid }, patientContext);
    } catch {
      console.error("voice.connection_rejected", { reason: "context_unavailable" });
      return json({ error: "voice_context_unavailable" }, 503);
    }

    // Do not forward the credential into the Durable Object's persisted connection URI.
    url.searchParams.delete("token");
    const sanitizedRequest = new Request(url, request);
    for (const name of ["authorization"]) sanitizedRequest.headers.delete(name);

    return (
      await routeAgentRequest(sanitizedRequest, env)
    ) ?? json({ error: "not_found" }, 404);
  },
} satisfies ExportedHandler<AppEnv>;
