import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import mongoose from "mongoose";

const CAPABILITY_AUDIENCE = "mediclarity-voice-worker";
const CAPABILITY_TTL_SECONDS = 120;
const SERVICE_CLOCK_SKEW_SECONDS = 60;
const MIN_SECRET_BYTES = 32;

export interface VoiceCapabilityClaims {
  sub: string;
  sid: string;
  aud: typeof CAPABILITY_AUDIENCE;
  iat: number;
  exp: number;
  jti: string;
}

function requiredSecret(name: "VOICE_CAPABILITY_SECRET" | "VOICE_SERVICE_SECRET") {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(`${name} must be configured with at least ${MIN_SECRET_BYTES} bytes`);
  }
  return value;
}

export function getVoiceWorkerUrl() {
  const raw = process.env.CLOUDFLARE_VOICE_WORKER_URL;
  if (!raw) throw new Error("CLOUDFLARE_VOICE_WORKER_URL is not configured");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("CLOUDFLARE_VOICE_WORKER_URL must be a valid URL");
  }

  const localDevelopment = process.env.NODE_ENV !== "production"
    && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Error("CLOUDFLARE_VOICE_WORKER_URL must use HTTPS");
  }
  if (url.username || url.password || url.hash || url.search || url.pathname !== "/") {
    throw new Error("CLOUDFLARE_VOICE_WORKER_URL must be an origin without credentials, query, path, or fragment");
  }
  return url.toString();
}

function encode(value: object | string) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(serialized, "utf8").toString("base64url");
}

function equalText(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function createVoiceCapability(userId: string, sessionId: string, now = new Date()) {
  if (!userId || !sessionId) throw new Error("A user and session are required");
  const issuedAt = Math.floor(now.getTime() / 1000);
  const claims: VoiceCapabilityClaims = {
    sub: userId,
    sid: sessionId,
    aud: CAPABILITY_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + CAPABILITY_TTL_SECONDS,
    jti: randomUUID(),
  };
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode(claims);
  const signature = createHmac("sha256", requiredSecret("VOICE_CAPABILITY_SECRET"))
    .update(`${header}.${payload}`)
    .digest("base64url");
  return { token: `${header}.${payload}.${signature}`, claims };
}

export function verifyVoiceCapability(token: string, now = new Date()): VoiceCapabilityClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, suppliedSignature] = parts;
  const expectedSignature = createHmac("sha256", requiredSecret("VOICE_CAPABILITY_SECRET"))
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (!equalText(suppliedSignature, expectedSignature)) return null;

  try {
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as unknown;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<VoiceCapabilityClaims>;
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (
      typeof parsedHeader !== "object" || parsedHeader === null
      || (parsedHeader as { alg?: unknown }).alg !== "HS256"
      || (parsedHeader as { typ?: unknown }).typ !== "JWT"
      || typeof claims.sub !== "string" || !claims.sub
      || typeof claims.sid !== "string" || !claims.sid
      || claims.aud !== CAPABILITY_AUDIENCE
      || typeof claims.iat !== "number" || claims.iat > nowSeconds + SERVICE_CLOCK_SKEW_SECONDS
      || typeof claims.exp !== "number" || claims.exp <= nowSeconds
      || claims.exp - claims.iat !== CAPABILITY_TTL_SECONDS
      || typeof claims.jti !== "string" || !claims.jti
    ) return null;
    return claims as VoiceCapabilityClaims;
  } catch {
    return null;
  }
}

export function voiceServiceSignature(method: string, pathname: string, timestamp: string, nonce: string, body: string) {
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  return createHmac("sha256", requiredSecret("VOICE_SERVICE_SECRET"))
    .update(`${method.toUpperCase()}\n${pathname}\n${timestamp}\n${nonce}\n${bodyHash}`)
    .digest("hex");
}

export function verifyVoiceServiceRequest(input: {
  method: string;
  pathname: string;
  timestamp: string | null;
  nonce: string | null;
  signature: string | null;
  body: string;
}, now = new Date()) {
  const { timestamp, nonce, signature } = input;
  if (!timestamp || !nonce || !signature) return false;
  if (!/^\d{10}$/.test(timestamp) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) {
    return false;
  }
  const requestSeconds = Number(timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - requestSeconds) > SERVICE_CLOCK_SKEW_SECONDS) return false;
  const expected = voiceServiceSignature(input.method, input.pathname, timestamp, nonce, input.body);
  return equalText(signature, expected);
}

let nonceIndexReady = false;

export async function consumeVoiceServiceNonce(nonce: string, now = new Date()) {
  const collection = mongoose.connection.collection<{ _id: string; expiresAt: Date }>("voice_request_nonces");
  if (!nonceIndexReady) {
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    nonceIndexReady = true;
  }
  try {
    await collection.insertOne({
      _id: nonce,
      expiresAt: new Date(now.getTime() + SERVICE_CLOCK_SKEW_SECONDS * 2 * 1000),
    });
    return true;
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) return false;
    throw error;
  }
}
