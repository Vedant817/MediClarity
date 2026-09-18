# MediClarity

MediClarity turns lab PDFs and phone photos into source-linked, comparable lab rows. The consumer product adds explanations, trends, expiring doctor/family shares, medication extraction, education, and conservative care direction. The Lab plan exposes the same OCR → normalized JSON → FHIR-shaped Observation pipeline through an API.

This is health-information software, not a diagnostic or emergency service. Candidate aliases and LOINC mappings require clinical validation.

## What is implemented

Plan gates match `src/config/product.ts` and `src/lib/entitlements.ts`. Free accounts get three reports per month plus summaries and Q&A. Pro ($19/mo) unlocks the longitudinal record. Lab API ($99/mo + $0.05/report) adds keyed API access and share-link branding.

### Health record

| Capability | Where | Notes |
| --- | --- | --- |
| Upload PDF or photo | `/dashboard/upload` | Cloudinary storage, Mistral OCR, structured lab extraction, summary, meds, education cards |
| Patient-friendly summary | Report dialog on `/dashboard/reports` | Open-weight LLM via Groq or Ollama; never diagnoses |
| Structured lab rows | Report dialog, `/dashboard/trends` | Test, value, unit, source reference range, flag, optional LOINC |
| Lab trends | `/dashboard/trends` | Pro/Lab. Line charts against each test’s own range; abnormal values highlighted |
| 3D Explain | Report dialog → Visualize tab; also on public share pages | Pro/Lab. Nine illustrated organs, healthy vs affected, red-flag copy, Hindi and simple-language captions. See `ATTRIBUTION.md` |
| Record chat | `/dashboard/chat` | Answers only from the signed-in user’s reports and labs |
| Translation + read-aloud | Report dialog | Summaries in English, Hindi, Punjabi, Spanish, Arabic, Portuguese, French. Playback uses the device’s `speechSynthesis` voices |
| Health dashboard | `/dashboard` | Recent reports, upcoming appointments, latest abnormal labs, medication count, monthly quota |
| Profile | `/dashboard/profile` | Account snapshot of the same record |

### Care

| Capability | Where | Notes |
| --- | --- | --- |
| Voice assistant | `/dashboard/voice` | Talk through the record in 10 Indian languages. Next.js issues a short-lived capability; the Cloudflare Worker runs STT → Llama → device TTS with barge-in |
| Medications | `/dashboard/meds` | Pro/Lab. Extracted from reports plus manual entries; OpenFDA label scan for pharmacist-review combination flags |
| Care direction | `/dashboard/triage` | Pro/Lab. Symptom list → urgency, timeframe, specialist, red flags. Not a diagnosis |
| Appointments | `/dashboard/appointments` | Real slots from the Provider collection, reminders, attended outcomes on the timeline, AI scheduler chat |
| Learn | `/dashboard/learn` | Pro/Lab. Short explainers generated from findings in the user’s own reports |

### Share and Lab API

| Capability | Where | Notes |
| --- | --- | --- |
| Expiring share links | `/dashboard/reports` → Share | Pro/Lab. Token URL works without login (`/share/[token]`), WhatsApp text, audit log, TTL |
| Doctor packet PDF | Report dialog | Abnormal labs + summary + questions (jsPDF) |
| FHIR export | Report dialog | Observation JSON for that report |
| Lab Structure API | `/dashboard/api-keys`, `POST /api/v1/structure` | Lab plan. `x-api-key`, public `documentUrl` → labs + FHIR + summary. 10 req/min |
| Lab branding | `/dashboard/lab-brand` | Lab plan. Organization name, logo, accent color on public share pages. Custom domains are not included |
| Billing | `/pricing`, Settings | Stripe Checkout, customer portal, metered Lab usage |

### Account

| Capability | Where | Notes |
| --- | --- | --- |
| Settings | `/dashboard/settings` | Voice/summary language, region profile, date format, plan and quota, sign out |
| Auth | `/login`, `/signup` | Clerk |
| Legal drafts | `/privacy`, `/terms`, `/contact` | Launch drafts, not certification |

Marketing pages (`/`, `/pricing`) describe the same catalog. Coming-soon cards (wearables, predictive analytics, e-prescribing, custom telehealth video, emergency response) are **not** implemented.

## Stack

- Next.js 15, React 19, Clerk, MongoDB/Mongoose
- Cloudinary document storage and Mistral OCR
- Groq-hosted open-weight models by default, or Ollama for customer-controlled generation
- Stripe subscriptions and metered Lab API usage
- Cloudflare Agents, Durable Objects, Workers AI, and `@cloudflare/voice` for the patient voice channel
- Three.js / React Three Fiber for 3D Explain (`public/models/`, Human Reference Atlas, CC-BY 4.0)

The prior Gemini, Pinecone, and LangGraph paths have been removed from runtime dependencies.

## Repository layout

```
src/app/(app)/dashboard/   Patient app routes
src/app/api/               Next.js route handlers
src/lib/                   Extraction, entitlements, FHIR, share, OCR, LLM
src/models/                Mongoose schemas
cloudflare/voice-agent/    Isolated voice Worker
ml/                        Optional extraction LoRA starting point (not deployed)
sample-reports/            Fixture index only; PDFs are local
scripts/                   Anatomy fetch, provider seed, packet checks
```

## Local files that are not in git

Copy or generate these after clone. Templates that **are** committed show what is required.

| Local file | Create from | Required for |
| --- | --- | --- |
| `.env` | `.env.example` | Next.js app |
| `cloudflare/voice-agent/.dev.vars` | `cloudflare/voice-agent/.dev.vars.example` | Voice worker locally |
| `cloudflare/voice-agent/worker-configuration.d.ts` | `npm run cf-typegen` in that folder | Worker `typecheck` |
| `sample-reports/*.pdf` | See `sample-reports/README.md` | Optional click-through fixtures |
| `ml/data/`, `ml/outputs/` | Your own de-identified JSONL | Optional fine-tune track |

Do not commit `.env`, `.dev.vars`, real patient documents, OCR dumps, Playwright screenshots, or `sample-reports/*.pdf`. Rotate any credential that has ever appeared in Git history; ignoring the file does not invalidate an exposed key.

## Local setup

1. Copy `.env.example` to `.env` and configure Clerk, MongoDB, Cloudinary, Mistral, and either Groq or Ollama. Set `AUDIT_HASH_SECRET` to a long random value.
2. Install with `npm install --legacy-peer-deps` while the current LangChain peer range requires it.
3. Run `npm run dev`.
4. Optional appointments: set `ALLOW_DEVELOPMENT_FIXTURES=true` (never in production) and seed providers with `npx tsx scripts/physicians.ts`.
5. Optional 3D refresh: `node scripts/fetch-anatomy-models.mjs` (meshes are already vendored under `public/models/`).

## Patient voice agent

The voice channel is intentionally split across two runtimes:

- Next.js authenticates the signed-in patient with Clerk and builds a minimum-necessary snapshot from MongoDB.
- `cloudflare/voice-agent` runs the real-time STT → Llama → TTS pipeline in a per-session Durable Object. Cloudflare's voice client stops playback and aborts the active generation when the patient interrupts.

Generate two different random secrets of at least 32 bytes. Put the same values in the Next.js environment and in the Worker using `wrangler secret put`:

```powershell
cd cloudflare/voice-agent
npm install
npx wrangler secret put VOICE_CAPABILITY_SECRET
npx wrangler secret put VOICE_SERVICE_SECRET
npm run cf-typegen
npm run deploy
```

Set `NEXT_ORIGIN` and `ALLOWED_ORIGIN` in `cloudflare/voice-agent/wrangler.jsonc` to the deployed HTTPS Next.js origin. Then set `CLOUDFLARE_VOICE_WORKER_URL` in Next.js to the deployed Worker origin. The value must be an origin such as `https://mediclarity-voice-agent.example.workers.dev`, without an `/agents` path.

For local development, use the same secrets in `.env` and `cloudflare/voice-agent/.dev.vars`, keep both configured origins on `http://localhost:3000`, and run the Next.js and Worker development commands in separate terminals. Microphone capture requires localhost or HTTPS.

The Worker persists transcript messages in its Durable Object SQLite database. Raw microphone audio is not intentionally stored by this application. Before production use, define retention/deletion policy and confirm contractual, residency, and healthcare-data requirements for every configured vendor.

Full Worker notes: `cloudflare/voice-agent/README.md`.

## Billing setup

Create these Stripe resources and copy their identifiers into `.env`:

- recurring Pro price: $19/month
- recurring Lab base price: $99/month
- recurring metered usage price: $0.05/unit
- meter event name: `lab_report_processed`
- webhook for checkout completion and subscription create/update/delete events (`/api/webhooks/stripe`)
- customer portal configuration

The server maps the allowed plan name to environment-owned price IDs. Clients cannot submit arbitrary prices.

## Lab Structure API

Lab-plan keys are created in `/dashboard/api-keys`. Authenticate with the header, not a Clerk session:

```http
POST /api/v1/structure
Content-Type: application/json
x-api-key: <secret>

{
  "documentUrl": "https://example.com/report.pdf",
  "sourceLab": "Optional lab name",
  "sourceCountry": "IN",
  "reportDate": "2026-06-10"
}
```

Success returns `{ labs, fhir, summary, provenance, usageEventId }`. Missing or invalid keys return 401; over the per-minute limit returns 429. Document URLs must be public HTTPS and are checked against private-network addresses.

## 3D Explain

Interactive organ meshes are educational illustrations, not patient anatomy. Heart, lung, kidney, liver, intestine, pancreas, brain, bladder, and spleen come from the Human Reference Atlas 3D Reference Object Library (CC-BY 4.0). Stomach, nose/sinuses, and thyroid currently use placeholder cards rather than a wrong-organ mesh. Credits and license rules: `ATTRIBUTION.md`.

## Fine-tune track

`ml/` is a reproducible starting point for a lab-extraction LoRA. No production route points at an unvalidated fine-tuned endpoint. Groq/Ollama remain the runtime providers until an owner configures and approves one. See `ml/README.md` before preparing any data.

## Verification

```powershell
npm test
npm run typecheck
npm run lint
npm audit --omit=dev
npm run build
```

Voice Worker:

```powershell
npm run voice:test
npm run voice:typecheck
```

Live end-to-end acceptance additionally requires real Clerk sessions, a reachable MongoDB deployment, service credentials, Stripe test products/webhooks, and representative consented lab fixtures. Synthetic PDFs, if you generate them, belong in `sample-reports/` on your machine only.

## Important operating limits

- Source-lab reference intervals are authoritative; the app does not invent regional clinical ranges.
- General Lab API URLs are checked against private-network addresses, but production deployments should also enforce outbound network policy to close DNS-rebinding and redirect risks.
- Privacy/terms pages are transparent launch drafts, not legal or regulatory certification.
- Custom domains, e-prescribing, wearables, predictive analytics, custom telehealth video, and emergency response are not active capabilities.
- Read-aloud depends on voices installed on the user’s device; there is no server TTS fallback yet.
