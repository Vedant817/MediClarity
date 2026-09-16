# TTS Read-Aloud Fallback — Research & TODO

> Status: RESEARCH ONLY (no code yet). Decided 2026-09-16: keep device-only read-aloud for now; build a fallback when ready.
> Goal: every supported language gets a working read-aloud, even on devices with no installed voice.

## 1. Current state

- Read-aloud (`TextToSpeechButton`) and voice-agent spoken replies both use **browser/device `speechSynthesis`** — free, private, instant.
- Gap: devices without an installed voice for a language show "no device voice" (e.g. headless browsers ship almost no voices). Transcript/typed input still works.
- Per-language device-voice detection + UI gating already shipped (`PatientVoiceAgent.tsx`, `voiceSupport` map, red/green dot, "· no device voice" option suffix).

## 2. Language matrix to cover

| Surface | Languages |
|---|---|
| Summary read-aloud | en, hi, pa, es, ar, pt, fr |
| Voice-agent replies | en-IN, hi-IN, pa-IN, bn-IN, ta-IN, te-IN, mr-IN, gu-IN, kn-IN, ml-IN |

## 3. Options found (researched 2026-09-16)

### A. Sarvam Bulbul v3 — best paid fit for the 9 Indic locales (RESEARCHED, NOT CHOSEN)
- 11 Indian languages: hi, ta, te, bn, ml, mr, gu, kn, pa, or, as — covers all 9 Indic voice locales. 35+ native voices, Hinglish code-switching, Node SDK, sub-250ms streaming.
- Free tier: 1,000 credits. Then ~₹30/10K chars (≈₹6 per 2,000-char summary, first synthesis only — see caching).
- India-hosted, SOC 2 + ISO 27001. Docs: https://www.sarvam.ai/text-to-speech
- Gap: es/ar/pt/fr, en-IN.

### B. Government Bhashini mission APIs (ULCA/Dhruva) — FREE, official ✅ candidate for $0 stack
- Register org/startup at https://bhashini.gov.in (Udbhav startup program) → "Bhashini Udyat | API Key Generation" → call inference at `https://dhruva-api.bhashini.gov.in/services/inference/pipeline` with `userID` + `ulcaApiKey`.
- No published per-character pricing (Digital India mission; 300+ startups onboarded).
- TTS coverage (from pipeline configs): bn, en, gu, hi, kn, ml, mr, or, **pa**, ta, te — all 9 Indic locales + English.
- Gap: es/ar/pt/fr. Caveats: approval-gated, unpublished quotas, AI4Bharat-grade quality (good, not Sarvam-grade).
- Example client: https://github.com/AdityaKukreti/bhashini-api

### C. edge-tts — FREE, unlimited, no signup (unofficial) ✅ candidate for $0 stack
- Python: https://github.com/rany2/edge-tts (`pip install edge-tts`, LGPLv3) · TypeScript: https://github.com/ericc-ch/edge-tts (`@echristian/edge-tts`).
- 400+ neural voices, 100+ languages. Covers hi, bn, ta, te, mr, gu, kn, ml + es/ar/pt/fr. **Verify Punjabi via `edge-tts --list-voices` before relying on it.**
- Caveats: reverse-engineered MS endpoint (broken by Microsoft before, community keeps fixing), no SLA, needs a small server-side proxy (no CORS-safe browser use). Use as fallback, never the only leg.

### D. Hyperscaler free quotas (free tier behind a billing account — NOT card-free)
- Google Cloud TTS Standard: **4M chars/mo free** (≈2,000 summaries/mo), WaveNet/Chirp3 1M free. 380+ voices, 75+ langs — covers everything. Requires billing enabled + budget alerts.
- Azure Speech F0: **500k neural chars/mo free** (≈250 summaries/mo), **hard-throttles past quota (never charges)**. 600+ voices. F0 limit: 20 req/60s — fine for read-aloud.

### E. Self-hosted open weights ($0 marginal on own hardware; moat-aligned)
- **AI4Bharat Indic-TTS** (https://github.com/AI4Bharat/Indic-TTS): 13 Indian langs — covers 8/9 (all but Punjabi). Check repo license before commercial use.
- **Kokoro-82M** (Apache 2.0, CPU-friendly): first-class en/es/fr (+it/ja/zh); Hindi only via community pipelines.
- **Piper**: es/fr/pt/ar yes; NO Indian voices (only Nepali in-region).
- **EXCLUDED: Meta MMS-TTS** — covers 1,100+ langs but **CC-BY-NC 4.0 (non-commercial)** — poison for sellable SaaS.

## 4. Recommended stacks

### $0 stack (no card, no per-char billing)
Device voices → **Bhashini mission API** (9 Indic langs) → **edge-tts proxy** (es/ar/pt/fr + backup) → MP3 cache. Total new spend: ₹0.

### Balanced stack (best quality, near-zero cost)
Device voices → **Sarvam** (9 Indic) → **Google Standard 4M free tier** (es/ar/pt/fr) → MP3 cache.

### Universal cost rule (both stacks)
Summaries are immutable per report → cache MP3 by hash `(reportId + lang + voice)` (Cloudinary/DB) → each summary is synthesized **once ever**. Realistic ongoing cost ≈ ₹0.

## 5. Implementation TODO (when approved)

- [ ] Register org on Bhashini onboarding portal; request API key (services: tts for hi/pa/bn/ta/te/mr/gu/kn/ml/en); record quotas.
- [ ] Verify Punjabi voice exists: `edge-tts --list-voices | grep pa-IN`.
- [ ] Add `POST /api/tts` route: auth → per-language provider router (device-independent) → MP3 cache lookup → synthesize → store → return audio URL.
  - [ ] Bhashini adapter (ULCA pipeline: userID/key, serviceId per language).
  - [ ] edge-tts adapter (server-side call to MS endpoint; do NOT expose endpoint details client-side).
  - [ ] (Balanced stack only) Sarvam adapter + Google Cloud adapter behind env flags.
- [ ] Cache layer: key = sha256(reportId + lang + voice); store MP3 (Cloudinary or DB blob); serve with long cache headers.
- [ ] Client: `TextToSpeechButton` tries `speechSynthesis` voice first → falls back to `/api/tts` audio playback; keep "no device voice, playing server audio" affordance.
- [ ] Voice agent: same fallback for spoken replies (note: worker calls app over network — works only with reachable `NEXT_ORIGIN`, same constraint as AI remote dev).
- [ ] Cost guardrails: per-user monthly char cap, 402/upgrade CTA reuse, usage logging for billing dashboard.
- [ ] QA: all 10 voice locales + 7 summary langs produce audio; wrong-language regression test (rapid switch); offline-device path still works.
- [ ] Docs: update `cloudflare/voice-agent/README.md` + landing "Translation + read-aloud" card if server voices change plan badges.

## 6. Open questions
- Bhashini: actual rate limits/quotas on issued keys? (Check portal after registration.)
- edge-tts: pa-IN voice present? (One CLI command to confirm.)
- AI4Bharat Indic-TTS exact license for commercial SaaS use? (Check repo before self-host path.)
- Sarvam: confirm 1,000-credit free tier + ₹30/10K chars still current at build time.
