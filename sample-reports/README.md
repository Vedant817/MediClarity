# Sample Reports — Synthetic Test Fixtures

All files in this folder are **100% fictional**: patient Aarav Sharma does not
exist. Each PDF carries a "DEMO DOCUMENT — SYNTHETIC DATA" footer. Use them
to click-test MediClarity end to end. Upload in numbered order.

| File | Panel | Date | Abnormal highlights | Tests this feature |
|---|---|---|---|---|
| 01-cbc-baseline.pdf | CBC, 8 tests | 10-Jun-2026 | Hgb low, platelets low, ESR high | Upload → OCR → extraction, flags |
| 02-lipid-panel.pdf | Lipids, 6 tests | 12-Jun-2026 | LDL/Chol/TG high, HDL low | Heart visualization, trends seed |
| 03-kidney-function.pdf | KFT, 7 tests + Atorvastatin | 05-Jul-2026 | Creatinine high, eGFR low | Kidney visualization, med extraction |
| 04-liver-function.pdf | LFT, 8 tests | 05-Jul-2026 | ALT/AST/bilirubin/GGT high | Liver visualization |
| 05-thyroid-diabetes.pdf | Thyroid + sugar, 5 tests + 2 meds | 12-Aug-2026 | TSH, glucose, HbA1c high | Thyroid placeholder card, pancreas viz, education cards, med interaction surface |
| 06-cbc-followup.pdf | CBC repeat, 8 tests | 10-Sep-2026 | Hgb back to normal, WBC high | **Trend lines** (Hemoglobin low→normal across 01→06), flag changes |

Suggested pass:
1. Upload 01 → check 8 rows, low/high flags, summary.
2. Upload 06 → open Trends → Hemoglobin line should span Jun→Sep.
3. Upload 03 → Meds page shows Atorvastatin; 05 adds Metformin.
4. Upload 04 → report dialog 3D tab shows Liver; 05 shows Thyroid placeholder card.
5. Share any report → open link incognito → 3D section renders.
6. Symptom check "chest pain, shortness of breath" → HIGH urgency, no diagnosis.
7. Bad-file checks: rename any `.txt` to `.pdf` and upload → must be rejected.

PDFs in this folder are gitignored. Keep this README; generate fixtures locally and never commit real patient documents.
