# Fine-Tuning Workspace Placeholder

This folder is intentionally kept as a small, auditable entry point rather than a fake training script.

Production implementation should add:

1. `prepare_dataset.py` — validates schema, strips identifiers, and writes train/validation/test JSONL.
2. `train_qlora.py` — runs QLoRA for `google/medgemma-4b-it` or another approved base model.
3. `evaluate_safety.py` — runs grounding, red-flag, missing-context, hallucination, and readability checks.
4. `model_card.md` — documents intended use, limitations, datasets, metrics, and deployment approval.

Do not commit patient data, generated adapters, or benchmark outputs containing PHI.
