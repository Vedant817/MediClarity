// Pagination stress: 40 lab rows + long summary must flow across pages
// with no clipped rows and no orphaned content.
import { jsPDF } from "jspdf";
import { buildDoctorPacket } from "../src/lib/doctor-packet.ts";

const names = ["Hemoglobin", "WBC", "Platelets", "Glucose, Fasting", "HbA1c", "Creatinine, Serum", "eGFR", "Urea, Serum"];
const labs = Array.from({ length: 40 }, (_, i) => ({
  test: `${names[i % names.length]} ${i + 1}`,
  value: (10 + i * 0.7).toFixed(1),
  unit: "mg/dL",
  refMin: 5,
  refMax: 15,
  flag: i % 3 === 0 ? "high" : i % 3 === 1 ? "low" : "normal",
}));
const para = "This is a long explanatory paragraph about kidney filtration markers and electrolytes that should wrap across many lines and flow onto subsequent pages without any clipping at the page edge. ".repeat(6);
const summary = `1. What this report was for\n${para}\n\n2. Main findings\n${para}\n\n- Bullet one with substantial detail that also wraps\n- Bullet two\n\n3. What the findings may mean\n${para}\n\n4. Key takeaways\n${para}`;

const pdf = new jsPDF({ unit: "pt", format: "a4" });
buildDoctorPacket(pdf, { createdAt: new Date("2026-09-16"), summary, labs });
const out = "C:/Users/vedan/AppData/Local/Temp/opencode/doctor-packet-stress.pdf";
pdf.save(out);
console.log(`saved ${out} pages=${pdf.getNumberOfPages()}`);
