// Headless verification for the doctor packet: builds a real PDF with the
// production builder using kidney-report-like fixture data (markdown table,
// en-dashes, bullets, emphasis) and saves it for raster inspection.
import { jsPDF } from "jspdf";
import { buildDoctorPacket } from "../src/lib/doctor-packet.ts";

const summary = `1. What this report was for
This is a Kidney Function Test (KFT) that measures how well the kidneys are filtering waste products from the blood and checks several related electrolytes and minerals.

2. Main findings
| Test | Result | Normal range | Flag |
|------|--------|--------------|------|
| Creatinine, Serum | 1.9 mg/dL | 0.7–1.3 | High |
| eGFR (estimated glomerular filtration rate) | 38 mL/min | 60–120 | Low |
| Urea, Serum | 52 mg/dL | 17–43 | High |
| BUN (blood urea nitrogen) | 24 mg/dL | 8–20 | High |
| Sodium, Serum | 139 mmol/L | 136–145 | Normal |
| Potassium, Serum | 4.8 mmol/L | 3.5–5.1 | Normal |
| Calcium, Serum | 8.4 mg/dL | 8.6–10.0 | Low |

3. What the findings may mean and appropriate questions for a clinician
- Elevated creatinine, urea, and BUN with a reduced eGFR suggest that the kidneys are not filtering as efficiently as expected.
Questions to ask:
- What could be causing the reduced kidney function (e.g., chronic kidney disease, dehydration, medication effects)?
- Are there any additional tests needed to clarify the cause (e.g., urine analysis, imaging, repeat eGFR)?
- **Current medication (atorvastatin)** is a cholesterol–lowering drug; some statins can have mild effects on kidney function in certain individuals.

4. Key takeaways
- Several kidney–related lab values are outside the normal range, indicating decreased kidney filtering ability.
- “Discuss these results” with a healthcare professional to understand the cause.`;

const labs = [
  { test: "Creatinine, Serum", value: 1.9, unit: "mg/dL", refMin: 0.7, refMax: 1.3, flag: "high" },
  { test: "eGFR (estimated glomerular filtration rate)", value: 38, unit: "mL/min", refMin: 60, refMax: 120, flag: "low" },
  { test: "Urea, Serum", value: 52, unit: "mg/dL", refMin: 17, refMax: 43, flag: "high" },
  { test: "BUN (blood urea nitrogen)", value: 24, unit: "mg/dL", refMin: 8, refMax: 20, flag: "high" },
  { test: "Sodium, Serum", value: 139, unit: "mmol/L", refMin: 136, refMax: 145, flag: "normal" },
  { test: "Potassium, Serum", value: 4.8, unit: "mmol/L", refMin: 3.5, refMax: 5.1, flag: "normal" },
  { test: "Calcium, Serum", value: 8.4, unit: "mg/dL", refMin: 8.6, refMax: 10.0, flag: "low" },
];

const pdf = new jsPDF({ unit: "pt", format: "a4" });
buildDoctorPacket(pdf, { createdAt: new Date("2026-09-16"), summary, labs });
const out = process.argv[2] ?? "C:/Users/vedan/AppData/Local/Temp/opencode/doctor-packet-verify.pdf";
pdf.save(out);
console.log(`saved ${out} pages=${pdf.getNumberOfPages()}`);
