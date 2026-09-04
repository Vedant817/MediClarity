# MediClarity - AGENTS.md - Sellable SaaS Execution Plan v2.2
# Stack: Next.js 15 + Clerk + MongoDB + Cloudinary + Open-Source LLM (Groq -> Fine-tuned BioMistral)
# Diagram Corrected + Gemini Replaced + Blockchain Removed

> Copy-paste each AGENT block into opencode/cursor/claude as separate agent. Run AGENT 0 first. All paths relative to project root.

---

## 0. MASTER ORCHESTRATOR PROMPT [COPY-PASTE THIS TO MAIN AGENT]

```
You are the MediClarity Orchestrator. You have 5 worker agents + 1 fine-tune track. Your codebase is Next.js 15 in C:\Users\vedan\Downloads\mediclarity.

Current audit: 
- Working: upload -> Cloudinary -> Mistral OCR -> Gemini Summary -> Chat Q&A (src/app/(app)/dashboard/upload/page.tsx:67, src/app/api/ocr/route.ts:9, src/app/api/summaries/route.ts:35)
- Broken: in-memory chatSessions src/app/api/chat/route.ts:5, auth trusts body userId src/app/api/reports/getReports/route.ts:9 vs correct auth() src/app/api/user-data/route.ts:15, mock availability 2025 src/lib/availability.ts:13, leaked .env:1, Pinecone+LangGraph unused package.json:20, TODO RAG src/app/api/chatbot/chat/route.ts:6
- Landing claims fake: BioBERT/ClinicalBERT src/app/page.tsx:282

GOAL: Make it sellable SaaS with open-source moat: Replace Gemini with Groq Llama-3.1-8B -> Fine-tuned BioMistral-7B, convert markdown summary src/models/report.ts:17 to structured LabResult JSON for trends, add family share + Stripe $19/mo + Lab API $99/mo. CUT Blockchain, CUT building 12 features at once.

EXECUTE IN ORDER:
1. Agent 0 - P0 Hardening (blocking, 2 days)
2. After 0 passes: Agent 1 (AI Abstraction) + Agent 2 (Structured Labs) in parallel
3. Agent 3 - Portal + RBAC
4. Agent 4 - Triage + Meds + Education
5. Agent 5 - Lab API + Billing
Parallel: Fine-Tune Track (dataset -> LoRA)

Acceptance for sellable: npm run build passes, free user blocked after 3 uploads, upload PDF -> LabResult JSON -> trends chart -> share link works incognito -> Groq works with no GEMINI_API_KEY.

Start with Agent 0 now. Do not proceed until Agent 0 ACCEPT criteria pass.
```

---

## AGENT 0 - P0 PLATFORM HARDENING [BLOCKING - 2 DAYS] - DO NOT SKIP

```
You are Agent 0 - Platform Hardening. You fix security and data integrity. No new features until you pass. Work in C:\Users\vedan\Downloads\mediclarity.

CONTEXT FILES: src/app/api/reports/getReports/route.ts:1, src/app/api/chat/route.ts:1, src/app/api/user-data/route.ts:1, src/lib/db.ts, src/models/appointment.ts, src/models/report.ts, src/lib/availability.ts, src/models/conversation.ts, .env

TASK 1 - Fix Auth Model (Critical):
- Search all `src/app/api/**` for `req.json().userId` or `searchParams.get('userId')`. Replace with `const {userId} = await auth() from @clerk/nextjs/server` like src/app/api/user-data/route.ts:15 does.
- Affected: src/app/api/reports/getReports/route.ts:9 (currently POST {userId}), src/app/api/chat/route.ts, src/app/api/chatbot/chat/route.ts, src/app/api/upload/route.ts, src/app/api/reports/save/route.ts, src/app/api/appointment/scheduler/route.ts:14.
- Client: src/app/(app)/dashboard/reports/page.tsx:34 remove userId from body, src/app/(app)/dashboard/upload/page.tsx:142, src/components/HealthTimeline.tsx. Server must derive userId.
- Return 401 if !userId.

TASK 2 - Fix Runtime:
- Grep `export const runtime = 'edge'` and delete where mongoose/src/lib/db.ts is imported (Edge + Mongoose = crash).

TASK 3 - Appointment Integrity:
- Verify src/models/appointment.ts:11-14 has reminderSent, followUpSent + indexes. Add pre-save to set reminderSentAt/followUpSentAt to now when flipped. Add unique index on {providerId, date, time, status: scheduled} to prevent double book. Delete src/lib/availability.ts:13 mock 2025 data. Make getAvailability() query Appointment collection: find({providerId, date, status: 'scheduled'}) and compute free slots from timeSlots src/lib/data.ts:58. Unify date format to YYYY-MM-DD ISO everywhere.

TASK 4 - Chat Safety & Persistence:
- Replace prompt src/app/api/chat/route.ts:35-48 and src/app/api/chatbot/chat/route.ts:35-54: Remove "Never say I can't answer". Add: "You are a health information assistant, not a doctor. If info not in report, say 'Not in report - ask your doctor'. Always add disclaimer. Never diagnose."
- Delete in-memory `const chatSessions: Record<string, ChatSession> = {}` src/app/api/chat/route.ts:5 and src/app/api/chatbot/chat/route.ts:5. Persist to src/models/conversation.ts like src/app/api/appointment/scheduler/route.ts:22 does (findOne conversationId, push messages, save). Chat must survive restart.

TASK 5 - Rotate Leaked Secrets:
- .env:1 contains MISTRAL_API_KEY, GEMINI_API_KEY, MONGO_URI, CLERK_SECRET, PINECONE_API_KEY, CLOUDINARY secrets. Regenerate all in dashboards. Add .env to .gitignore if not. Warn user.

ACCEPTANCE:
- `npm run build` passes, no Edge+Mongoose error
- `curl /api/user-data` without cookie -> 401, with cookie -> 200
- `curl POST /api/reports/getReports {}` without auth -> 401 (not 200)
- Upload report, restart dev server, chat history still loads
- No 2025 mock dates in code, availability reads from DB
```

---

## AGENT 1 - AI ABSTRACTION + OPEN SOURCE SWAP [WEEK 1 - 2 DAYS]

```
You are Agent 1 - Replace Gemini with Open Weights via abstraction. Depends on Agent 0.

CONTEXT: src/app/api/summaries/route.ts:1, src/app/api/chat/route.ts:1, src/app/api/translate/route.ts:1, src/app/api/chatbot/chat/route.ts:1, src/app/api/appointment/scheduler/route.ts:1, src/lib/embeddings.ts:1, src/lib/vector.ts

CREATE src/lib/llm.ts:
import { ChatGroq } from "@langchain/groq"; import { ChatOllama } from "@langchain/ollama"; import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
export const getLLM = (task: 'extract'|'chat'|'triage'|'translate' = 'chat') => {
  const provider = process.env.AI_PROVIDER || 'groq';
  if(provider === 'groq') return new ChatGroq({ apiKey: process.env.GROQ_API_KEY!, model: task==='extract' ? "llama-3.1-8b-instant" : "llama-3.1-8b-instant", temperature: task==='extract'?0:0.3, maxTokens: task==='extract'?2000:1500 });
  if(provider === 'ollama') return new ChatOllama({ model: "qwen2.5:7b", temperature: 0.3 });
  // fallback
  return new ChatGroq({ apiKey: process.env.GROQ_API_KEY!, model: "llama-3.1-8b-instant" });
}
export const getEmbeddings = () => new HuggingFaceTransformersEmbeddings({ model: "Xenova/bge-base-en-v1.5" }); // local, no API
// For translation: use getLLM('translate') with NLLB later, for now Groq with translate prompt

REPLACE:
- src/app/api/summaries/route.ts:4 const genAI -> getLLM('extract'), result.response.text() -> await llm.invoke(patientFriendlyPrompt)
- src/app/api/chat/route.ts:1,4 same + replace startChat history with LangChain HumanMessage/SystemMessage like scheduler:7 does
- src/app/api/translate/route.ts:4 same
- src/app/api/chatbot/chat/route.ts:32 same
- src/app/api/appointment/scheduler/route.ts:7 ChatGoogleGenerativeAI -> getLLM('chat')
- src/lib/embeddings.ts:1 GoogleGenerativeAIEmbeddings -> getEmbeddings()

ENV: Add to .env.example and .env: AI_PROVIDER=groq, GROQ_API_KEY=gsk_..., HF_TOKEN=..., keep GEMINI as fallback GEMINI_API_KEY.

INSTALL: npm install @langchain/groq @langchain/community @xenova/transformers

ACCEPTANCE:
- With AI_PROVIDER=groq and GROQ_API_KEY set, no GEMINI_API_KEY needed: upload PDF -> summary generated, chat replies, translation works, scheduler streams.
- With AI_PROVIDER=ollama and `ollama run qwen2.5:7b`, same flows work offline.
- src/lib/embeddings.ts embedDocuments uses BGE locally and PineconeStore still works.
```

---

## AGENT 2 - STRUCTURED LAB ENGINE [WEEK 2-3 - HIGHEST MOAT - DATA GREEN BOX]

```
You are Agent 2 - Data Integration & Standardization (Diagram Green Box: Unified Lab Results Formatting + Multi-source Document Integration). Depends on Agent 1.

CREATE src/models/labResult.ts:
import mongoose from "mongoose";
const LabResultSchema = new mongoose.Schema({
  userId: {type: String, required: true, index: true},
  reportId: {type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true},
  test: {type: String, required: true, index: true}, // e.g. Hemoglobin
  value: {type: Number, required: true},
  unit: {type: String}, // g/dL
  refMin: {type: Number},
  refMax: {type: Number},
  flag: {type: String, enum: ['normal','high','low'], default: 'normal', index: true},
  date: {type: Date, default: Date.now, index: true},
  loinc: {type: String}, // optional LOINC code
  source: {type: String, default: 'ocr'}
});
LabResultSchema.index({userId:1, test:1, date:-1});
export default mongoose.models.LabResult || mongoose.model('LabResult', LabResultSchema);

MODIFY src/app/api/summaries/route.ts:
- After const fullText = ocrData.extractedText... src/app/(app)/dashboard/upload/page.tsx:118
- Keep existing summary call
- ADD second call: const extractPrompt = `Extract all lab tests as JSON array. Text: """${fullText}""" Return ONLY JSON: [{"test":"Hemoglobin","value":13.2,"unit":"g/dL","refMin":13,"refMax":17,"flag":"normal"}] If no labs, return [].`; 
- const jsonStr = await getLLM('extract').invoke(extractPrompt); Parse with zod `z.array(z.object({test:z.string(), value:z.number(), unit:z.string().optional(), refMin:z.number().optional(), refMax:z.number().optional(), flag:z.enum(['normal','high','low'])}))`. On parse fail, retry once.
- After save Report src/app/(app)/dashboard/upload/page.tsx:142, bulk insert LabResults with reportId.

MODIFY src/models/report.ts: add labResults: [{type: mongoose.Schema.Types.ObjectId, ref: 'LabResult'}]

CREATE src/app/(app)/dashboard/trends/page.tsx (Advanced Analytics Dashboard - Temporal Analysis):
- Fetch /api/labs?groupBy=test
- Use recharts LineChart: x=date, y=value, refMin/refMax as dashed lines, flag dots red.
- Table Unified Lab Results Formatting: show all labs normalized, multi-source if user has 3 reports, highlight abnormal.
- Customizable Dashboards: Select test dropdown.

CREATE src/app/api/labs/route.ts: GET auth() -> LabResult.find({userId}).sort({date:-1})

ACCEPTANCE:
- Upload CBC report with 10 labs -> 10 LabResult docs in DB with correct flag high/low, reportId linked
- /dashboard/trends shows Hemoglobin trend if 2 reports uploaded, abnormal values red
- Invalid LLM JSON does not crash, returns [] and logs
```

---

## AGENT 3 - PATIENT PORTAL + SECURITY [WEEK 3-4 - RED/GOLD BOXES - CUT BLOCKCHAIN]

```
You are Agent 3 - Enhanced Security & Compliance (Granular Access, NOT Blockchain) + User-Centric Patient Portal. Depends on Agent 2.

CREATE src/models/vaultShare.ts:
import mongoose from "mongoose";
const VaultShareSchema = new mongoose.Schema({
  reportId: {type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true},
  ownerId: {type: String, required: true, index: true}, // Clerk userId
  sharedWithEmail: {type: String},
  token: {type: String, required: true, unique: true, index: true}, // crypto.randomUUID
  role: {type: String, enum: ['viewer'], default: 'viewer'},
  expiresAt: {type: Date, required: true, index: {expires:0}}, // TTL
  createdAt: {type: Date, default: Date.now}
});
export default mongoose.models.VaultShare || mongoose.model('VaultShare', VaultShareSchema);

CREATE src/models/auditLog.ts:
{userId, action: 'view'|'share'|'download', resourceId, resourceType: 'report'|'lab', ip, timestamp: Date, metadata}

CREATE src/app/api/share/route.ts:
- POST auth() -> {reportId, email, expiresInDays:7} -> verify report.userId===userId -> create VaultShare token -> return `${NEXT_PUBLIC_BASE_URL}/share/${token}`
- GET /share/[token]/route.ts -> find VaultShare where token && expiresAt > now -> return report + LabResults without auth, log audit. Expired -> 410.

CREATE src/app/share/[token]/page.tsx: Public page rendering report summary + lab table + disclaimer, no login required.

MODIFY src/app/(app)/dashboard/reports/page.tsx:113: Add Share button next to View Full Report -> dialog with email input + expiry dropdown + copy link + WhatsApp share `https://wa.me/?text=`.

ENHANCE src/app/(app)/dashboard/page.tsx Health Dashboard (User-Centric Patient Portal):
- Keep metrics cards src/app/(app)/dashboard/page.tsx:103
- ADD section: Latest Abnormal Labs (query LabResult flag != normal limit 3)
- ADD section: Medication count (from Agent 4, placeholder now)
- ADD CTA: Share with Doctor generates doctor-summary.pdf (use jsPDF): Table of abnormal labs + summary + patient questions. Button `Export FHIR` returns Observation JSON.

ACCEPTANCE:
- Create share link, open in incognito -> report visible without login, expires after TTL, auditLog created
- Dashboard shows "2 Abnormal: LDL High" if lab flag high
- No blockchain code exists
```

---

## AGENT 4 - USER-CENTRIC + CLINICAL DECISION [WEEK 5-7 - TEAL BOX - SAFE TRIAGE]

```
You are Agent 4 - Symptom Checker + Medication Management + Personalized Education. Depends on Agent 3.

TASK A - Symptom Checker (AI-Assisted Abnormality Detection, NOT Diagnostic Suggestions):
CREATE src/app/api/triage/route.ts:
- POST {symptoms: string[], age, sex} auth()
- Prompt via getLLM('triage'): `You are triage assistant, NOT doctor. Symptoms: ${symptoms}. Return JSON: {urgency:'low'|'medium'|'high', timeframe: '1-3 days'|'1-2 weeks'|'1-2 months', specialist: string, redFlags: string[], selfCare: string[], disclaimer: 'This is triage only, not diagnosis. See doctor.'} Use findingsToSpecialistMap src/lib/ai-service.ts:19 and urgencyMap:47 logic as reference. Never say you have X disease.`
- Validate zod, map urgency to timeframeMap src/lib/ai-service.ts:64.
- Link to match-providers.

CREATE src/app/(app)/dashboard/symptom/page.tsx: Input symptoms chips + age/sex -> call triage -> show urgency badge color (red/yellow/green) + specialist + redFlags + CTA Schedule src/app/(app)/dashboard/appointments/page.tsx

TASK B - Medication Management:
CREATE src/models/medication.ts: {userId index, reportId, name String, dose String, frequency String, startDate Date, endDate Date, status: 'active'|'stopped', source:'ocr'|'manual'}
MODIFY upload flow: After lab extraction, 3rd LLM call: `Extract medications as JSON [{"name":"Atorvastatin","dose":"10mg","frequency":"once daily"}]`. Save to Medication.
CREATE src/app/(app)/dashboard/meds/page.tsx: List meds, add manual, check interactions: for each pair call `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${name}"` and naive check `if label contains other drug name -> warn`. Show warning badge. Cron `src/app/api/meds/reminder/route.ts` uses job-auth like appointment reminders.

TASK C - Personalized Educational Content:
After summary, call getLLM('chat'): `For patient with summary: """${summary}""" Generate 3 article titles + 1-line summary in simple language for conditions found. JSON [{"title":"What is High Cholesterol?","summary":"..."}]`. Show in report dialog src/app/(app)/dashboard/reports/page.tsx:115 and dedicated /dashboard/learn page.

SAFETY: Every response includes "For information only, not medical advice".

ACCEPTANCE:
- Symptom checker for "chest pain + shortness breath" -> urgency high, timeframe 1-3 days, cardiology, redFlags includes "call ER if..."
- Upload report with "Medications: Atorvastatin 10mg" -> meds page shows it, interaction check runs
- Report dialog shows 3 education cards relevant to labs
- No prompt says "diagnose" or "you have"
```

---

## AGENT 5 - INTEROPERABILITY + MONETIZATION [WEEK 8-10 - YELLOW BOX - SELLABLE]

```
You are Agent 5 - API Integration + Medical Standards + Billing. Depends on Agent 4.

TASK A - Lab API / White-label (Interoperability Enhancements):
CREATE src/models/apiKey.ts: {userId, key: String unique, name, createdAt, lastUsedAt, quota: Number}
CREATE src/app/api/v1/structure/route.ts:
- POST header `x-api-key` -> lookup apiKey -> rate limit (10/min)
- Body {documentUrl: string, webhookUrl?: string}
- Reuse Agent 1 ocr + Agent 2 extract logic: runOcrFromImageUrl src/lib/ocr.ts:6 -> getLLM('extract') -> Lab JSON
- Return {labs: LabResult[], fhir: {resourceType:'Observation', code: {coding:[{system:'http://loinc.org', code: loinc}]}, valueQuantity: {value, unit}}[], summary: string}
- This is Medical Standards Integration: map test names to LOINC via simple dict {Hemoglobin: '718-7', Cholesterol: '2093-3'}. Use official LOINC where possible.
- Log usage for billing.

CREATE src/app/(app)/dashboard/api-keys/page.tsx: Generate/revoke keys, show usage.

TASK B - E-Prescription + Telehealth Stubs (Do NOT build full):
- CREATE src/app/(app)/dashboard/rx/page.tsx: Placeholder "E-Prescription Generation (FHIR MedicationRequest) - Coming Soon. Requires doctor verification. View only." Show meds with print button.
- Telehealth: Add TelehealthIntegration card src/app/page.tsx:139 linking to Whereby/Calendly embed or  `Connect via WhatsApp/Meet` - no custom video infra.

TASK C - Billing (Sellable SaaS):
- Install `stripe` + `@clerk/nextjs` billing or `stripe` directly.
- CREATE src/lib/entitlements.ts:
  export const getEntitlements = async (userId) => {
    const sub = await stripe.subscriptions.list({customer: clerkUserId});
    const plan = sub.data[0]?.items.data[0].price.lookup_key; // free, pro, lab
    if(plan==='lab') return {maxReports: Infinity, trends: true, share: true, api: true};
    if(plan==='pro') return {maxReports: Infinity, trends: true, share: true, api: false};
    return {maxReports: 3, trends: false, share: false, api: false}; // free
  }
- MODIFY src/app/api/upload/route.ts: Before upload, check Report.countDocuments({userId, createdAt: {$gte: firstDayOfMonth}}) >= entitlements.maxReports -> 402 Payment Required.
- MODIFY src/app/(app)/dashboard/trends/page.tsx: if !entitlements.trends -> show paywall overlay.
- MODIFY src/app/page.tsx:47 pricing: Free $0 (3/mo), Pro $19/mo (unlimited + trends+share+meds), Lab API $99/mo + $0.05/report (white-label).
- Webhook src/app/api/webhooks/stripe/route.ts to update Clerk metadata.

ACCEPTANCE:
- `curl -H "x-api-key: sk_test..." -d '{"documentUrl":"https://.../report.pdf"}' /api/v1/structure` returns labs + FHIR without session, 401 without key, 429 after limit
- Free user 4th upload in same month -> 402 with upgrade CTA
- Pricing page shows $19 and $99, webhook flips user to pro
- No actual prescribing logic exists (legal safe)
```

---

## FINE-TUNE TRACK [PARALLEL WEEK 3-8 - OWNER + 1 AGENT]

```
You are Fine-Tune Track - Own the model (Moat vs Gemini wrapper).

DATASET:
- Export `SELECT ocr FROM Report` 200 real rows from production MongoDB (anonymized)
- Generate synthetic: Use Groq Llama-70B to create 5k pairs `prompt: "OCR text: """+realOCR+""" -> JSON labs"` -> labs JSON. Distillation from Groq 70B.
- Manually correct 500 rows for Indian reference ranges (e.g., Hemoglobin 13-17 male, 12-15 female, Vitamin D 20-50 ng/mL) - this is your edge vs US-trained Gemini.
- Format as Alpaca instruction: {"instruction": "Extract labs...", "input": "OCR...", "output": "[{...}]"}

TRAIN:
- Base: BioMistral-7B (BioMistral/BioMistral-7B) or OpenBioLLM-8B (aaditya/OpenBioLLM-Llama3-8B) - both Apache 2.0/commercial OK. 7B fits 1xA100.
- Tool: Unsloth + Axolotl, LoRA r=16, alpha=32, 3 epochs, lr 2e-4, on RunPod A100 40GB $1.5/hr ~3hrs = $5, or Together Fine-Tune API free.
- Alternative if no GPU: HuggingFace AutoTrain.

EVAL:
- Holdout 100 rows, metric JSON validity >98%, flag F1 >0.92 vs Gemini baseline, latency <1s on vLLM.
- Deploy to HuggingFace Inference Endpoint (vLLM, auto-scale, $0.60/hr) or RunPod serverless.
- Update src/lib/llm.ts getLLM('extract') to point to HF endpoint `https://xxx.hf.space/v1`. Keep Groq for chat.

PITCH: "Fine-tuned 8B on 5k Indian labs - 40% cheaper, on-prem, beats Gemini on extraction, data never leaves VPC" - YC loves this slide.
```

---

## SELLABLE CHECKLIST (YC DUE DILIGENCE)

- [ ] Landing claims removed: Delete BioBERT x4, 99.9% Accuracy, HIPAA badges unless you have BAA - replace with "For information only"
- [ ] .env rotated, .gitignore has .env
- [ ] Free 3/mo gate works, Stripe $19 Pro, $99 Lab API
- [ ] Upload -> Lab JSON -> Trends works end-to-end
- [ ] Share link + audit log works
- [ ] Symptom triage has disclaimer, never diagnosis
- [ ] Lab API returns FHIR + 401 without key
- [ ] Groq works, no Gemini key required
- [ ] One lab pilot LOI (even free) for distribution story

## WHAT NOT TO BUILD FOR MVP (Show as Coming Soon)

Wearables Integration, Predictive Analytics, Emergency SOS, Blockchain, Custom Telehealth video - add pricing cards "Coming Soon" but don't code. They add 3 months, 0 MRR.

## YC PITCH NARRATIVE

70% of health data is unreadable PDFs. Labs, clinics, 1.4B Indians get PDFs they can't use. Gemini wrappers rent Google and can't sell to hospitals. MediClarity is the open-source structuring layer: PDF -> FHIR JSON -> Trends -> Care Coordination. Started B2C for data, now labs pay $0.05/report to structure it. Own fine-tuned BioMistral, on-prem box for hospitals that can't send data to Google. Network: Patient brings family, family brings doctor, doctor brings clinic.
```

