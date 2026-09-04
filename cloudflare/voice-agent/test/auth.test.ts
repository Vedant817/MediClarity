import { describe, expect, it } from "vitest";
import { agentInstanceName, verifyConnectionToken, type ConnectionClaims } from "../src/auth";

const encoder = new TextEncoder();
const base64Url = (value: Uint8Array | string) => {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

async function sign(claims: ConnectionClaims, secret = "a-test-secret-with-at-least-32-bytes") {
  const input = `${base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64Url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(input)));
  return `${input}.${base64Url(signature)}`;
}

const claims: ConnectionClaims = {
  aud: "mediclarity-voice-worker",
  sub: "user_123",
  sid: "voice_session_123456",
  iat: 1_000,
  exp: 1_120,
  jti: "nonce_1234567890",
};

describe("connection token verification", () => {
  it("accepts a correctly scoped short-lived token", async () => {
    const token = await sign(claims);
    await expect(verifyConnectionToken(token, "a-test-secret-with-at-least-32-bytes", {
      audience: claims.aud,
      now: 1_050,
    })).resolves.toEqual(claims);
  });

  it("rejects tampering, expiry, and long-lived tokens", async () => {
    const valid = await sign(claims);
    await expect(verifyConnectionToken(`${valid.slice(0, -1)}x`, "a-test-secret-with-at-least-32-bytes", {
      audience: claims.aud, now: 1_050,
    })).rejects.toThrow();
    await expect(verifyConnectionToken(valid, "a-test-secret-with-at-least-32-bytes", {
      audience: claims.aud, now: 1_200,
    })).rejects.toThrow("token not active");
    const longLived = await sign({ ...claims, exp: 1_500 });
    await expect(verifyConnectionToken(longLived, "a-test-secret-with-at-least-32-bytes", {
      audience: claims.aud, now: 1_050,
    })).rejects.toThrow("invalid token lifetime");
  });
});

it("extracts the agent instance safely", () => {
  expect(agentInstanceName("/agents/patient-voice-agent/voice_session_123456")).toBe("voice_session_123456");
  expect(agentInstanceName("/health")).toBeNull();
});
