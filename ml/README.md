# MediClarity extraction model track

This directory is a reproducible starting point for the planned lab-extraction LoRA. It is not evidence that a model has been trained, evaluated, or deployed.

## Safety boundary

- Never export production OCR into this directory by default.
- Obtain consent and a documented processing purpose before using patient records.
- De-identify outside the training environment, review samples manually, and keep source data encrypted with access logs.
- Synthetic examples are only pipeline fixtures; they are not a clinical benchmark.
- Reference intervals printed by the source laboratory remain authoritative. The model must not invent regional ranges.

## Dataset contract

Each JSONL row follows `dataset.schema.json` and uses an Alpaca-compatible `instruction`, `input`, and JSON-string `output`. Split by source document, never by page, to prevent leakage. Keep a locked holdout set that is never used for prompt iteration.

## Proposed run

1. Put approved, de-identified JSONL in a private dataset store.
2. Validate it against `dataset.schema.json`.
3. Review `axolotl-biomistral-lora.yml`, pin the container and package versions, then run it on an isolated GPU worker.
4. Save base-model revision, dataset digest, config, seed, adapter digest, and runtime logs.
5. Run `python evaluate.py --predictions predictions.jsonl` against the locked holdout.
6. Promote only if JSON validity, exact field coverage, numeric error, and flag F1 satisfy a signed evaluation policy. The targets in the product plan are goals, not current results.

No production route points at an unvalidated fine-tuned endpoint. Groq/Ollama remain the explicit runtime providers until an owner configures and approves one.
