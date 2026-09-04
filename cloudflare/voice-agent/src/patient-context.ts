export interface PatientContext {
  displayName?: string;
  generatedAt?: string;
  preferences: { locale?: string; regionProfile?: string; dateFormat?: string };
  recentReports: Array<{ reportDate?: string; sourceLab?: string; summary: string }>;
  recentLabs: Array<{ test: string; value: number; unit?: string; flag?: string; date?: string; referenceRange?: { min?: number; max?: number } }>;
  activeMedications: Array<{ name: string; dose?: string; frequency?: string; startDate?: string }>;
  upcomingAppointments: Array<{ date: string; time?: string; providerId?: string; appointmentType?: string }>;
}

export interface PatientContextEnv {
  NEXT_ORIGIN: string;
  VOICE_SERVICE_SECRET: string;
}

const encoder = new TextEncoder();
const MAX_CONTEXT_BYTES = 64 * 1024;

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function signServiceRequest(
  secret: string,
  input: { timestamp: string; nonce: string; method: string; pathname: string; body: string },
): Promise<{ bodyHash: string; signature: string }> {
  if (encoder.encode(secret).byteLength < 32) throw new Error("service secret is too short");
  const bodyHash = await sha256(input.body);
  const canonical = `${input.method.toUpperCase()}\n${input.pathname}\n${input.timestamp}\n${input.nonce}\n${bodyHash}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return { bodyHash, signature: hex(await crypto.subtle.sign("HMAC", key, encoder.encode(canonical))) };
}

function text(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
  return cleaned || undefined;
}

function list(value: unknown, limit: number): unknown[] {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

export function normalizePatientContext(value: unknown): PatientContext {
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const activeMedications = list(root.activeMedications, 25).flatMap((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const name = text(item.name, 120);
    return name ? [{ name, dose: text(item.dose, 100), frequency: text(item.frequency, 160), startDate: text(item.startDate, 40) }] : [];
  });
  const recentLabs = list(root.recentLabs, 100).flatMap((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const test = text(item.test, 120);
    const range = item.referenceRange && typeof item.referenceRange === "object" ? item.referenceRange as Record<string, unknown> : {};
    const referenceRange = {
      min: typeof range.min === "number" && Number.isFinite(range.min) ? range.min : undefined,
      max: typeof range.max === "number" && Number.isFinite(range.max) ? range.max : undefined,
    };
    return test && typeof item.value === "number" && Number.isFinite(item.value)
      ? [{ test, value: item.value, unit: text(item.unit, 40), flag: text(item.flag, 20), date: text(item.date, 40), referenceRange }]
      : [];
  });
  const recentReports = list(root.recentReports, 12).flatMap((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const summary = text(item.summary, 4000);
    return summary ? [{ reportDate: text(item.reportDate, 40), sourceLab: text(item.sourceLab, 160), summary }] : [];
  });
  const upcomingAppointments = list(root.upcomingAppointments, 20).flatMap((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const date = text(item.date, 40);
    return date ? [{ date, time: text(item.time, 30), providerId: text(item.providerId, 128), appointmentType: text(item.appointmentType, 80) }] : [];
  });
  const preferences = root.preferences && typeof root.preferences === "object"
    ? {
        locale: text((root.preferences as Record<string, unknown>).locale, 50),
        regionProfile: text((root.preferences as Record<string, unknown>).regionProfile, 50),
        dateFormat: text((root.preferences as Record<string, unknown>).dateFormat, 50),
      }
    : {};
  return {
    displayName: text(root.displayName, 100),
    generatedAt: text(root.generatedAt, 40),
    preferences,
    recentLabs,
    recentReports,
    activeMedications,
    upcomingAppointments,
  };
}

export async function fetchPatientContext(
  env: PatientContextEnv,
  identity: { sessionId: string; capabilityToken: string },
  signal?: AbortSignal,
): Promise<PatientContext> {
  const endpoint = new URL("/api/voice/context", env.NEXT_ORIGIN);
  const body = JSON.stringify(identity);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const signed = await signServiceRequest(env.VOICE_SERVICE_SECRET, {
    timestamp,
    nonce,
    method: "POST",
    pathname: endpoint.pathname,
    body,
  });
  const timeout = AbortSignal.timeout(5000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-voice-timestamp": timestamp,
      "x-voice-nonce": nonce,
      "x-voice-signature": signed.signature,
    },
    body,
    signal: combinedSignal,
  });
  if (!response.ok) throw new Error(`patient context request failed (${response.status})`);
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_CONTEXT_BYTES) throw new Error("patient context response too large");
  const raw = await response.text();
  if (encoder.encode(raw).byteLength > MAX_CONTEXT_BYTES) throw new Error("patient context response too large");
  const parsed = JSON.parse(raw) as { sessionId?: unknown; patientContext?: unknown };
  if (parsed.sessionId !== identity.sessionId) throw new Error("patient context session mismatch");
  return normalizePatientContext(parsed.patientContext);
}
