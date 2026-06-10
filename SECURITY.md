# Security Policy

MediClarity handles potentially sensitive medical-report content. Treat every uploaded document, OCR result, summary, embedding, and chat message as protected health information (PHI) unless a deployment has explicitly proven otherwise.

## Supported Versions

| Version | Supported |
| --- | --- |
| `0.1.x` | Best-effort security fixes for the current resume/MVP branch |
| `< 0.1.0` | Unsupported |

## Current security posture

This repository is not yet HIPAA-certified, SOC 2 certified, or ISO 27001 certified. Do not market a deployment as compliant until the hosting, vendors, data retention, audit logging, access controls, incident response, and legal agreements have been completed and independently reviewed.

## Sensitive data rules

- Do not commit real patient documents, OCR text, screenshots, logs, or model outputs containing PHI.
- Do not use production PHI for fine-tuning without documented consent, de-identification, governance, and retention controls.
- Do not log raw report text, generated summaries, or full chat transcripts by default.
- Prefer short-lived signed file access, scoped authorization checks, and deletion workflows across database, object storage, and vector storage.

## Reporting a vulnerability

If you find a vulnerability, open a private security advisory or contact the maintainer directly. Include:

1. Affected route or file.
2. Reproduction steps.
3. Potential impact, especially PHI exposure or cross-user access.
4. Suggested fix if known.

Please do not include real patient data in a report.
