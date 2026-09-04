# MediClarity Cloudflare Voice Agent

An isolated Cloudflare Worker/Durable Object voice runtime for authenticated MediClarity patients. It uses:

- `@cloudflare/voice` for continuous speech-to-text, streaming text-to-speech, automatic interruption/barge-in, and SQLite conversation persistence.
- Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for responses.
- `agents` and a SQLite-backed Durable Object per voice session.
- A 120-second HS256 capability issued by the authenticated Next.js application.
- A separately signed server-to-server request to load current patient context. The browser cannot supply or override patient data.

`@cloudflare/voice` is experimental. Its version is deliberately pinned; review its changelog and rerun all gates before upgrading.

## Runtime flow

1. The logged-in browser calls MediClarity `POST /api/voice/session`.
2. Next.js returns `{ workerUrl, sessionId, capabilityToken, expiresAt }`.
3. The browser connects to the Worker agent named `patient-voice-agent`, using `sessionId` as the Durable Object name and the capability as the `token` query parameter.
4. The Worker checks the exact browser `Origin`, verifies the HS256 signature/audience/lifetime, and requires the URL instance name to equal the signed `sid`.
5. Before routing the WebSocket, the Worker calls Next.js `POST /api/voice/context` with a separate HMAC service signature. The capability remains ephemeral and is stripped before the request reaches the Durable Object.
6. The Durable Object stores its bound identity and bounded, normalized context in a private SQLite table so calls survive hibernation. It does not broadcast this data through Agent state. `withVoice` stores completed user/assistant turns in Durable Object SQLite.
7. Flux STT detects speech start. `withVoice` cancels active speech/LLM work, and `context.signal` is forwarded to Workers AI so a patient can naturally interrupt the answer.

## Configuration

Non-secret values are in `wrangler.jsonc`:

```json
{
  "NEXT_ORIGIN": "https://app.mediclarity.example",
  "ALLOWED_ORIGIN": "https://app.mediclarity.example",
  "TOKEN_AUDIENCE": "mediclarity-voice-worker"
}
```

Set two different random secrets of at least 32 UTF-8 bytes. Their values must match the corresponding Next.js environment variables:

```sh
npx wrangler secret put VOICE_CAPABILITY_SECRET
npx wrangler secret put VOICE_SERVICE_SECRET
```

For local development, copy `.dev.vars.example` to `.dev.vars`. Never commit `.dev.vars`.

The Next context endpoint contract is:

```text
POST /api/voice/context
x-voice-timestamp: Unix seconds
x-voice-nonce: random UUID
x-voice-signature: hex(HMAC-SHA256(VOICE_SERVICE_SECRET, canonical))

canonical = METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + NONCE + "\n" + hex(sha256(rawBody))
rawBody = {"sessionId":"...","capabilityToken":"..."}
```

It returns `{ sessionId, patientContext }`. The endpoint must verify and consume the nonce, re-verify the capability, derive the user from its signed `sub`, and return `Cache-Control: no-store, private`.

## Browser connection

The voice client natively supports a query map:

```ts
import { VoiceClient } from "@cloudflare/voice/client";

const client = new VoiceClient({
  agent: "patient-voice-agent",
  name: sessionId,
  host: new URL(workerUrl).host,
  query: { token: capabilityToken },
});

client.connect();
await client.startCall();
```

Obtain a fresh capability before reconnecting after its expiry. Do not store it in local storage or log the connection URL. Production access logs should redact the `token` query parameter.

## Safety and privacy properties

- The assistant explicitly identifies itself as AI and never claims to be a clinician.
- It provides health information, not diagnosis, prescribing, or medication changes.
- Missing facts are identified as absent from the record; abnormal results and treatment decisions are referred to a clinician.
- Urgent warning signs receive an emergency-services recommendation without a diagnosis.
- Patient records are delimited as untrusted data to reduce record-borne prompt injection.
- Application logs contain event/reason codes only—no transcript, token, user ID, or patient context.
- `/health` is public and returns only static service health.
- Bounded context and transcripts remain in Durable Object SQLite until the application retention policy removes the session; raw microphone audio is not intentionally stored by this code.

This implementation is not, by itself, evidence of HIPAA or other regulatory compliance. Deployment configuration, vendor agreements, access controls, retention, auditability, and incident processes still require separate review.

## Develop and verify

```sh
npm install
npm run cf-typegen
npm run typecheck
npm test
npx wrangler deploy --dry-run
```

For local end-to-end use, run Next.js at `NEXT_ORIGIN`, configure matching secrets in both processes, then run `npm run dev`. A real Cloudflare account with Workers AI access is required to exercise Flux STT, Llama 3.3, Aura TTS, WebSockets, and Durable Object persistence.
