# MediClarity

MediClarity is a full-stack AI medical-report explainability app built with Next.js. It lets an authenticated user upload a lab, imaging, pathology, or discharge report, runs OCR, creates a patient-friendly summary, stores the report, and supports follow-up Q&A grounded in the uploaded report through retrieval-augmented generation (RAG).

> **Safety scope:** MediClarity is an educational report-understanding tool. It is not a diagnostic device, does not prescribe treatment, and should not be used as the sole source for patient management decisions.

## What this project demonstrates

This repository is positioned as a software-engineering resume project that goes beyond a demo prompt wrapper:

- Authenticated document ingestion with Clerk-protected dashboard routes.
- OCR pipeline for PDFs and medical-report images.
- LLM summary, translation, and conversational report explanation.
- MongoDB persistence for report history.
- Pinecone-backed RAG for report-grounded chat.
- Centralized model configuration and reusable clinical safety prompts.
- Production architecture plan for privacy, model evaluation, observability, and open-weight fine-tuning.

## Current architecture

```mermaid
flowchart LR
  User[Authenticated user] --> UI[Next.js App Router UI]
  UI --> Upload[/api/upload]
  Upload --> Cloudinary[(Cloudinary storage)]
  UI --> OCR[/api/ocr]
  OCR --> Mistral[Mistral OCR]
  UI --> Summary[/api/summaries]
  Summary --> Gemini[Gemini model]
  UI --> Save[/api/reports/save]
  Save --> Mongo[(MongoDB Report collection)]
  UI --> Init[/api/chatbot/initialize-session]
  Init --> Embeddings[Gemini embeddings]
  Embeddings --> Pinecone[(Pinecone namespace)]
  UI --> Chat[/api/chatbot/chat]
  Chat --> Pinecone
  Chat --> Gemini
```

## Implemented hardening in this version

- **Centralized model selection:** model names are configurable through environment variables instead of being scattered through API routes.
- **Reusable clinical safety contract:** summary, translation, and chat prompts now share a grounding-first safety policy.
- **Input normalization:** report text and target-language inputs are trimmed and bounded before model calls.
- **Authenticated report reads:** report list/detail APIs now derive the user from Clerk auth instead of trusting a client-supplied `userId`.
- **User-scoped vector namespaces:** RAG session namespaces are derived from both Clerk `userId` and `sessionId`, preventing cross-user namespace deletion/search if a session ID is reused or guessed.
- **Controlled OCR inputs:** OCR only accepts HTTPS Cloudinary URLs from this app's per-user upload folder instead of arbitrary remote URLs.
- **Upload validation:** upload route now requires authentication, checks MIME type, enforces a configurable file-size limit, sanitizes filenames, and stores files in per-user Cloudinary folders.
- **Prompt-injection framing:** report text, OCR text, and retrieved snippets are explicitly delimited as untrusted clinical content so models extract facts rather than follow document-embedded instructions.
- **Chunked RAG ingestion:** long summaries/OCR documents are chunked before embedding, improving retrieval quality over whole-document vectors.
- **Open-weight adaptation plan:** the repo documents how to move from API-hosted models to medically adapted open-weight models without pretending fine-tuning can be done safely inside the web app runtime.

## Domain analysis: important issues and product gaps

### Medical AI safety gaps

1. **The product must not diagnose.** A report explainer should distinguish patient-specific report facts from general education and should escalate urgent symptoms to emergency care.
2. **Normal ranges are context-dependent.** Lab ranges vary by lab, age, sex, pregnancy status, and units. The assistant must preserve the report's own units/ranges and avoid inventing ranges.
3. **OCR is clinically risky.** Misread decimals, units, dates, and medication names can materially change meaning. The UI should show extracted text for confirmation and track OCR confidence when available.
4. **RAG is required even after fine-tuning.** Fine-tuned models can improve language and medical style, but patient-specific claims must remain grounded in the uploaded document.
5. **No raw PHI in telemetry.** Logs, analytics, vector metadata, and error traces should avoid report text and direct identifiers.
6. **Regulatory positioning must be explicit.** The safe resume/project scope is patient education and document comprehension, not autonomous diagnosis, triage, or treatment recommendation.

### Implementation gaps still to address

| Area | Current state | Production-grade plan |
| --- | --- | --- |
| Storage privacy | Uploads go to Cloudinary and URLs are passed to OCR. | Use private object storage, signed short-lived URLs, encryption at rest, retention policies, and deletion workflows. |
| AuthZ | Report reads are now Clerk-derived. | Add organization/team scopes, audit logs, and object-level access tests. |
| RAG quality | Session-level chunks are embedded. | Chunk by report section/page, store page numbers, add source snippets, rerank results, and show citations in answers. |
| OCR validation | OCR output is accepted directly. | Add preview/correction UI, confidence warnings, duplicate-page detection, and unit/decimal validation. |
| Model safety | Shared prompts added. | Add automated eval suite for hallucination, missing context, red-flag escalation, and readability. |
| Observability | Console logs only. | Add structured logs, trace IDs, model/version metadata, latency/cost metrics, and PHI-safe error reporting. |
| Compliance | Not HIPAA-ready. | Add BAA-compatible vendors, data processing agreements, retention controls, access logs, and threat model. |
| Testing | Minimal project checks. | Add route tests, prompt regression tests, RAG fixtures, and Playwright upload/chat flows. |

## Model strategy

The app currently uses API-hosted models for a working real-time product:

- **OCR:** `MISTRAL_OCR_MODEL`, default `mistral-ocr-latest`.
- **Summaries:** `GEMINI_SUMMARY_MODEL`, default `gemini-1.5-pro`.
- **Chat:** `GEMINI_CHAT_MODEL`, default `gemini-2.0-flash`.
- **Translations:** `GEMINI_TRANSLATION_MODEL`, default `gemini-1.5-pro`.
- **Embeddings:** `GEMINI_EMBEDDING_MODEL`, default `gemini-embedding-exp-03-07`.

For an open-weight path, the recommended first fine-tuning target is **MedGemma 4B IT** because it is designed for medical text/image development and is small enough for practical QLoRA experimentation. For stronger text-only medical reasoning, evaluate **MedGemma 27B text**. For multilingual/general fallback, evaluate a permissive open model such as **Qwen3 8B** only after safety benchmarking.

See [`docs/ml/fine-tuning-plan.md`](docs/ml/fine-tuning-plan.md) for the concrete adaptation plan.

External research references used for this model strategy:

- Google Research MedGemma announcement and safety disclaimer: https://research.google/blog/medgemma-our-most-capable-open-models-for-health-ai-development/
- Llama-3-Meditron medical open-weight paper: https://openreview.net/forum?id=ZcD35zKujO
- Qwen model family reference: https://qwenlm.github.io/

## End-to-end user flow

1. User signs up or logs in with Clerk.
2. User uploads a PDF/image report.
3. `/api/upload` validates the file and uploads it to Cloudinary.
4. `/api/ocr` sends the document URL to OCR and returns extracted page text.
5. `/api/summaries` generates a structured patient-friendly summary.
6. `/api/reports/save` stores the report, OCR text, and summary in MongoDB.
7. `/api/chatbot/initialize-session` embeds summary/OCR chunks into a Pinecone namespace.
8. `/api/chatbot/chat` retrieves relevant chunks and answers questions with safety constraints.
9. `/api/translate` translates the summary while preserving numbers, units, and medical terms.

## Environment setup

Copy `.env.example` to `.env.local` and fill in real service credentials.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required services:

- Clerk application keys.
- MongoDB database.
- Cloudinary account.
- Mistral API key for OCR.
- Gemini API key for generation and embeddings.
- Pinecone index for vector search.

## Scripts

```bash
npm run dev      # Start local Next.js dev server
npm run build    # Build production bundle
npm run lint     # Run ESLint
```

## Advanced implementation roadmap

### Phase 1 — Product correctness and trust

- Add OCR review screen where users can correct extracted text before summarization.
- Persist page-level OCR with source page index and file metadata.
- Add answer citations that reference report page/section snippets.
- Add clinician-review disclaimer and red-flag emergency guidance in the UI.
- Add deletion workflow that removes MongoDB report records, Cloudinary files, and Pinecone namespaces.

### Phase 2 — Production architecture

- Introduce a provider interface: `AIProvider.generateSummary`, `AIProvider.chat`, `AIProvider.translate`, `EmbeddingProvider.embed`.
- Add queue-based processing for large documents using background jobs.
- Replace session-memory chat storage with durable conversation state.
- Add rate limiting per user and per route.
- Add OpenTelemetry traces and PHI-safe structured logs.
- Use private object storage with signed URLs instead of public document URLs.

### Phase 3 — Clinical domain depth

- Parse report types: CBC, CMP, lipid panel, HbA1c, thyroid, urinalysis, radiology, pathology, discharge summary.
- Add unit-aware abnormal-value extraction.
- Add medication mention extraction and warnings to verify with a clinician/pharmacist.
- Add timeline extraction for hospital encounters.
- Add uncertainty labels: `directly stated`, `inferred from report wording`, `general education`, `not present in report`.

### Phase 4 — Model evaluation and fine-tuning

- Build a PHI-free evaluation dataset with lab/radiology/pathology/discharge examples.
- Add prompt regression tests for hallucination, missing context, red flags, and unit preservation.
- Train a QLoRA adapter for `google/medgemma-4b-it` using only governed datasets.
- Compare Gemini API, base MedGemma, fine-tuned MedGemma, and RAG-only baselines.
- Promote a model only if it passes safety gates and has a documented model card.

## Non-goals

- No autonomous diagnosis.
- No treatment recommendation without clinician review.
- No emergency triage replacement.
- No real patient-data fine-tuning without formal governance.
- No hidden hardcoded model behavior; production model choices should be configured, versioned, and evaluated.

## Repository map

```text
src/app/api/upload/route.ts                  Authenticated upload and file validation
src/app/api/ocr/route.ts                     OCR extraction endpoint
src/app/api/summaries/route.ts               Report summary generation
src/app/api/translate/route.ts               Medical-summary translation
src/app/api/chatbot/initialize-session/route.ts  RAG session initialization
src/app/api/chatbot/chat/route.ts            RAG-grounded chat endpoint
src/app/api/reports/*                        Report persistence and authenticated reads
src/lib/ai/model-config.ts                   Central model/runtime configuration
src/lib/ai/prompts.ts                        Shared safety and grounding prompts
src/lib/ai/validation.ts                     Input normalization helpers
src/lib/embeddings.ts                        Gemini embeddings + Pinecone integration
src/lib/ocr.ts                               Mistral OCR client
src/models/report.ts                         MongoDB report schema
docs/ml/fine-tuning-plan.md                  Open-weight medical model adaptation plan
```

## Resume bullets this project can support

- Designed and implemented an AI medical-report explainability platform with OCR, RAG, authenticated persistence, and LLM safety guardrails.
- Refactored hardcoded model calls into configurable provider-ready runtime settings across summarization, chat, translation, OCR, and embeddings.
- Hardened report access by replacing client-supplied user IDs with Clerk-derived authorization checks.
- Built a production roadmap covering PHI-safe logging, signed document storage, model evaluation, RAG citations, and QLoRA fine-tuning for open-weight medical models.
