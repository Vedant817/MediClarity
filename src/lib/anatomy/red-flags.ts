import type { OrganId } from "./types.ts";

/**
 * Curated, generic urgent-care pointers per organ. These are NOT diagnoses
 * and never reference the patient's report: they list widely-known warning
 * signs that warrant prompt clinical attention, in the same language as the
 * triage fallback. Rendered under every 3D explanation.
 */
export const EMERGENCY_LINE =
  "If symptoms are severe, sudden, or worsening, contact local emergency services.";

export const ORGAN_RED_FLAGS: Record<OrganId, string[]> = {
  heart: [
    "Chest pain, pressure, or tightness",
    "Trouble breathing or shortness of breath at rest",
    "Fainting or feeling about to faint",
    "Pain spreading to the arm, neck, or jaw",
  ],
  lung: [
    "Severe trouble breathing",
    "Bluish lips or face",
    "Coughing up blood",
    "Chest pain with fever",
  ],
  kidney: [
    "Very little or no urine",
    "Swelling of the face, hands, or legs with reduced urine",
    "Severe back or side pain with fever",
    "New confusion with reduced urine",
  ],
  liver: [
    "Yellowing of the skin or eyes with abdominal pain",
    "Vomiting blood",
    "Black or tarry stools",
    "New confusion with liver symptoms",
  ],
  stomach: [
    "Vomiting blood",
    "Black or tarry stools",
    "Severe abdominal pain that does not ease",
    "Trouble swallowing with weight loss",
  ],
  intestine: [
    "Severe abdominal pain with swelling",
    "Vomiting blood or black stools",
    "Inability to pass stool or gas with pain",
    "Severe diarrhea with dizziness",
  ],
  pancreas: [
    "Severe upper abdominal pain spreading to the back",
    "Persistent vomiting with abdominal pain",
    "Fever with severe abdominal pain",
  ],
  brain: [
    "Sudden severe headache unlike any before",
    "Weakness on one side of the body",
    "Trouble speaking or understanding speech",
    "Sudden vision loss, seizure, or fainting",
  ],
  thyroid: [
    "Neck swelling with trouble breathing or swallowing",
    "Racing heartbeat with chest pain",
    "Severe agitation or confusion with fever",
  ],
  "nose-sinus": [
    "High fever with severe headache",
    "Swelling around the eyes",
    "Vision changes with sinus pain",
    "Stiff neck with fever",
  ],
  bladder: [
    "Inability to pass urine with pain",
    "Severe lower abdominal pain",
    "Fever with burning urination or back pain",
  ],
  spleen: [
    "Severe left-side abdominal pain, especially after an injury",
    "Dizziness or fainting with abdominal pain",
    "Rapid heartbeat with abdominal pain",
  ],
};
