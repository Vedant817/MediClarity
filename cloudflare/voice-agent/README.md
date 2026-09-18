# MediClarity Cloudflare Voice Agent

An isolated Cloudflare Worker/Durable Object voice runtime for authenticated MediClarity patients. It uses:

- `@cloudflare/voice` for continuous speech-to-text, streaming text-to-speech, automatic interruption/barge-in, and SQLite conversation persistence.
- Workers AI `@cf/meta/llama-3.1-8b-instruct-fp8-fast` for lower-cost multilingual responses.
- Hybrid speech recognition over the Workers AI binding, with no separate Deepgram API key: streaming Deepgram Nova-3 (general, `mip_opt_out`, model endpointing) for Indian English and Hindi, and Whisper Large v3 Turbo for Punjabi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, and Malayalam.
- Patient-specific lab, medication, and clinician names are supplied as Nova keyterms and as Whisper's initial prompt. Nova medical mode is not used because the current Cloudflare-hosted route rejects it.
- When Nova returns a transcript below the confidence threshold, the assistant repeats what it heard and asks for confirmation instead of answering the wrong question. Provider failures fall back to Whisper.
- The browser/device Web Speech synthesis engine for spoken output, so no separate speech-provider API key is required. Available voices depend on the user's operating system and browser.
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
6. The Durable Object stores its bound identity and bounded, normalized context in a private SQLite table so active calls survive hibernation. It does not broadcast this data through Agent state, and the context snapshot is deleted when the call ends. `withVoice` stores completed user/assistant turns in Durable Object SQLite.
7. Browser echo cancellation, noise suppression, and automatic gain control run before audio leaves the device. Adaptive VAD filters room noise before batch transcription. Browser speech is cancelled immediately on barge-in, the Worker receives an interrupt, and `context.signal` cancels active model work.

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

For local development, copy `.dev.vars.example` to `.dev.vars`. Never commit `.dev.vars`. After clone, run `npm run cf-typegen` to recreate `worker-configuration.d.ts` (generated Wrangler types are gitignored).

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
npm run deploy -- --dry-run
```

For local end-to-end use, run Next.js at `NEXT_ORIGIN`, configure matching capability/service secrets in both processes, then run `npm run dev`. A Cloudflare account with Workers AI access is required to exercise Nova-3, Whisper, Llama, WebSockets, and Durable Object persistence. No external speech API key is required. Nova-3 is a Cloudflare partner model provided by Deepgram and is billed per audio minute; Whisper remains the lower-cost multilingual path. This implementation opts out of Deepgram's model-improvement program (`mip_opt_out`). Confirm contractual, residency, and healthcare-data requirements before production use.

### Local Worker with remote AI

The checked-in `remote: true` AI binding keeps the Worker, WebSocket, and Durable Object local while forwarding Nova-3, Whisper, and Llama inference to the authenticated Cloudflare account. Start it with:

```sh
npm run dev
```

Do not add `--local`; that disables the remote AI binding and causes each transcription attempt to fail. Because only AI inference is remote:

- You must be logged in (`npx wrangler whoami`) with Workers AI enabled.
- `NEXT_ORIGIN` and `ALLOWED_ORIGIN` remain `http://localhost:3000`; no public tunnel is required.
- AI usage is billed to the account; keep test calls short.

### Nova-3 batch probe

`npm run probe:nova` starts a tiny Worker that POSTs a WAV through the same streamed-body Nova-3 binding the agent uses. Use consented phrases to compare recognition of lab names, medications, and Indian English before changing languages or keyterms:

```sh
curl -X POST "http://127.0.0.1:8788/?language=en-IN" --data-binary @phrase.wav
```

The Cloudflare-hosted route currently rejects Nova's medical tier; the probe and the agent both use `mode: "general"` with medical keyterms.
