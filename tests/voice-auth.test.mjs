import test from "node:test";
import assert from "node:assert/strict";
import {
  createVoiceCapability,
  getVoiceWorkerUrl,
  verifyVoiceCapability,
  verifyVoiceServiceRequest,
  voiceServiceSignature,
} from "../src/lib/voice-auth.ts";

const capabilitySecret = "capability-test-secret-that-is-at-least-32-bytes";
const serviceSecret = "service-test-secret-that-is-at-least-32-bytes";

test.before(() => {
  process.env.VOICE_CAPABILITY_SECRET = capabilitySecret;
  process.env.VOICE_SERVICE_SECRET = serviceSecret;
});

test("creates a short-lived capability bound to the user and session", () => {
  const now = new Date("2026-09-02T10:00:00.000Z");
  const { token, claims } = createVoiceCapability("user_123", "session_123", now);
  assert.equal(claims.exp - claims.iat, 120);
  assert.deepEqual(verifyVoiceCapability(token, now), claims);
  assert.equal(verifyVoiceCapability(`${token.slice(0, -1)}x`, now), null);
  assert.equal(verifyVoiceCapability(token, new Date("2026-09-02T10:02:01.000Z")), null);
});

test("authenticates the exact request body and rejects stale or changed requests", () => {
  const now = new Date("2026-09-02T10:00:00.000Z");
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const nonce = "unique_nonce_value_12345";
  const body = JSON.stringify({ sessionId: "session_123" });
  const signature = voiceServiceSignature("POST", "/api/voice/context", timestamp, nonce, body);
  const base = { method: "POST", pathname: "/api/voice/context", timestamp, nonce, signature };
  assert.equal(verifyVoiceServiceRequest({ ...base, body }, now), true);
  assert.equal(verifyVoiceServiceRequest({ ...base, body: `${body} ` }, now), false);
  assert.equal(verifyVoiceServiceRequest({ ...base, body }, new Date("2026-09-02T10:01:01.000Z")), false);
});

test("requires HTTPS for a deployed voice worker URL", () => {
  process.env.NODE_ENV = "production";
  process.env.CLOUDFLARE_VOICE_WORKER_URL = "http://voice.example.com/connect";
  assert.throws(() => getVoiceWorkerUrl(), /HTTPS/);
  process.env.CLOUDFLARE_VOICE_WORKER_URL = "https://voice.example.com/connect";
  assert.throws(() => getVoiceWorkerUrl(), /must be an origin/);
  process.env.CLOUDFLARE_VOICE_WORKER_URL = "https://voice.example.com";
  assert.equal(getVoiceWorkerUrl(), "https://voice.example.com/");
});
