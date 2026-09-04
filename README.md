# MediClarity

MediClarity turns lab PDFs and phone photos into source-linked, comparable lab rows. The consumer product adds explanations, trends, expiring doctor/family shares, medication extraction, education, and conservative care direction. The Lab plan exposes the same OCR to normalized JSON to FHIR-shaped Observation pipeline through an API.

This is health-information software, not a diagnostic or emergency service. Candidate aliases and LOINC mappings require clinical validation.

## Stack

- Next.js 15, React 19, Clerk, MongoDB/Mongoose
- Cloudinary document storage and Mistral OCR
- Groq-hosted Llama by default, or Ollama for customer-controlled generation
- Stripe subscriptions and metered Lab API usage
- Cloudflare Agents, Durable Objects, Workers AI Llama 3.3, and `@cloudflare/voice` for the patient voice channel

The prior Gemini, Pinecone, and LangGraph paths have been removed from runtime dependencies.

## Local setup

1. Copy `.env.example` to `.env` and configure Clerk, MongoDB, Cloudinary, Mistral, and either Groq or Ollama.
2. Install with `npm install --legacy-peer-deps` while the current LangChain peer range requires it.
3. Run `npm run dev`.

Do not commit `.env`. Rotate any credential that has ever appeared in Git history; ignoring the file does not invalidate an exposed key.

## Patient voice agent

The voice channel is intentionally split across two runtimes:

- Next.js authenticates the signed-in patient with Clerk and builds a minimum-necessary snapshot from MongoDB.
- `cloudflare/voice-agent` runs the real-time STT → Llama 3.3 → TTS pipeline in a per-session Durable Object. Cloudflare's voice client stops playback and aborts the active generation when the patient interrupts.

Generate two different random secrets of at least 32 bytes. Put the same values in the Next.js environment and in the Worker using `wrangler secret put`:

```powershell
cd cloudflare/voice-agent
npm install
npx wrangler secret put VOICE_CAPABILITY_SECRET
npx wrangler secret put VOICE_SERVICE_SECRET
npm run deploy
```

Set `NEXT_ORIGIN` and `ALLOWED_ORIGIN` in `cloudflare/voice-agent/wrangler.jsonc` to the deployed HTTPS Next.js origin. Then set `CLOUDFLARE_VOICE_WORKER_URL` in Next.js to the deployed Worker origin. The value must be an origin such as `https://mediclarity-voice-agent.example.workers.dev`, without an `/agents` path.

For local development, use the same secrets in `.env` and `cloudflare/voice-agent/.dev.vars`, keep both configured origins on `http://localhost:3000`, and run the Next.js and Worker development commands in separate terminals. Microphone capture requires localhost or HTTPS.

The Worker persists transcript messages in its Durable Object SQLite database. Raw microphone audio is not intentionally stored by this application. Before production use, define retention/deletion policy and confirm contractual, residency, and healthcare-data requirements for every configured vendor.

## Billing setup

Create these Stripe resources and copy their identifiers into `.env`:

- recurring Pro price: $19/month
- recurring Lab base price: $99/month
- recurring metered usage price: $0.05/unit
- meter event name: `lab_report_processed`
- webhook for checkout completion and subscription create/update/delete events
- customer portal configuration

The server maps the allowed plan name to environment-owned price IDs. Clients cannot submit arbitrary prices.

## Verification

```powershell
npm test
npm run typecheck
npm run lint
npm audit --omit=dev
npm run build
```

Live end-to-end acceptance additionally requires real Clerk sessions, a reachable MongoDB deployment, service credentials, Stripe test products/webhooks, and representative consented lab fixtures. See `ml/README.md` before preparing any fine-tuning data.

## Important operating limits

- Source-lab reference intervals are authoritative; the app does not invent regional clinical ranges.
- General Lab API URLs are checked against private-network addresses, but production deployments should also enforce outbound network policy to close DNS-rebinding and redirect risks.
- Privacy/terms pages are transparent launch drafts, not legal or regulatory certification.
- Custom domains, E-prescribing, wearables, predictive analytics, custom telehealth video, and emergency response are not active capabilities.
