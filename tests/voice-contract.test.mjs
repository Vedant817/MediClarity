import test from "node:test";
import assert from "node:assert/strict";
import {
  createVoiceCapability,
  verifyVoiceServiceRequest,
} from "../src/lib/voice-auth.ts";
import { verifyConnectionToken } from "../cloudflare/voice-agent/src/auth.ts";
import { signServiceRequest } from "../cloudflare/voice-agent/src/patient-context.ts";

const capabilitySecret = "cross-runtime-capability-secret-at-least-32-bytes";
const serviceSecret = "cross-runtime-service-secret-at-least-32-bytes";

test.before(() => {
  process.env.VOICE_CAPABILITY_SECRET = capabilitySecret;
  process.env.VOICE_SERVICE_SECRET = serviceSecret;
});

test("Next capability is accepted by the Cloudflare Worker verifier", async () => {
  const now = new Date("2026-09-02T10:00:00.000Z");
  const { token, claims } = createVoiceCapability("user_contract", "6edfde66-5ed0-4c36-8213-e85db3fdd459", now);
  const verified = await verifyConnectionToken(token, capabilitySecret, {
    audience: "mediclarity-voice-worker",
    now: Math.floor(now.getTime() / 1000),
  });
  assert.deepEqual(verified, claims);
});

test("Worker service signature is accepted by the Next context verifier", async () => {
  const now = new Date("2026-09-02T10:00:00.000Z");
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const nonce = "contract_nonce_value_12345";
  const body = JSON.stringify({
    sessionId: "6edfde66-5ed0-4c36-8213-e85db3fdd459",
    capabilityToken: "header.payload.signature",
  });
  const { signature } = await signServiceRequest(serviceSecret, {
    method: "POST",
    pathname: "/api/voice/context",
    timestamp,
    nonce,
    body,
  });
  assert.equal(verifyVoiceServiceRequest({
    method: "POST",
    pathname: "/api/voice/context",
    timestamp,
    nonce,
    signature,
    body,
  }, now), true);
});
