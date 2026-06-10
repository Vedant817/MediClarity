# Open-Weight Medical Model Adaptation Plan

MediClarity currently uses API-hosted Gemini and Mistral OCR for a runnable product. The production-grade open-weight path should be treated as a separate, evaluated model-release pipeline rather than a prompt swap.

## Recommended model choices

| Use case | Model | Why |
| --- | --- | --- |
| Resume-friendly local prototype | `google/medgemma-4b-it` | Medical text/image foundation, small enough for single-GPU QLoRA experiments. |
| Higher-accuracy text-only medical reasoning | `google/medgemma-27b-text-it` | Stronger medical QA/reasoning profile; use when GPU budget allows. |
| Multilingual/general fallback | `Qwen/Qwen3-8B` | Apache-2.0 general model family with strong multilingual coverage; fine-tune only after medical safety evaluation. |

## Dataset strategy

1. **Public medical QA and education**: MedQuAD, PubMedQA, MedMCQA, guideline FAQs, patient-facing discharge-instruction examples.
2. **Document-understanding synthetic data**: generate de-identified lab, radiology, pathology, and discharge-summary snippets with structured answers, but keep them clearly synthetic and separate from evaluation data.
3. **No real PHI in training** unless there is a documented consent, de-identification, retention, and governance process.
4. **Holdout evaluation** must include adversarial prompts, missing-context questions, abnormal-lab interpretation, red-flag symptoms, unit/reference-range preservation, and refusal/escalation scenarios.

## Training recipe

1. Convert records to instruction format with fields: `system`, `report_context`, `question`, `ideal_answer`, `grounding_required`, `safety_label`.
2. Run PII/PHI scrubbing before dataset export.
3. Use QLoRA with low learning rate, early stopping, and evaluation every few hundred steps.
4. Track model, tokenizer, dataset hash, LoRA adapter hash, evaluation suite version, and prompt contract in a model card.
5. Gate promotion on factuality, citation/grounding, red-flag escalation, and no-diagnosis compliance metrics.

## Serving architecture

- Keep RAG as the source of patient-specific facts even after fine-tuning.
- Serve the adapter behind a provider interface so the app can switch between Gemini API, local vLLM/TGI, or a hosted endpoint.
- Log only metadata and evaluation signals; do not log raw reports by default.
- Add canary deployment, rollback, and model-version headers on every AI response.

## Why not fine-tune in this web repo by default?

Fine-tuning needs GPU infrastructure, governed datasets, PHI controls, model cards, and clinical evaluation. This repo keeps the web product functional while documenting the exact path to an open-weight production model.
