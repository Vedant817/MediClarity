import type { NormalizedLab } from "@/lib/labs";

export function labToFhirObservation(lab: NormalizedLab) {
  return {
    resourceType: "Observation",
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }] }],
    code: {
      ...(lab.loinc ? { coding: [{ system: "http://loinc.org", code: lab.loinc, display: lab.canonicalName }] } : {}),
      text: lab.canonicalName,
    },
    effectiveDateTime: lab.date.toISOString(),
    valueQuantity: {
      value: lab.value,
      ...(lab.unit ? { unit: lab.unit, system: "http://unitsofmeasure.org", code: lab.unit } : {}),
    },
    ...(lab.refMin != null || lab.refMax != null ? {
      referenceRange: [{
        ...(lab.refMin != null ? { low: { value: lab.refMin, unit: lab.unit } } : {}),
        ...(lab.refMax != null ? { high: { value: lab.refMax, unit: lab.unit } } : {}),
      }],
    } : {}),
    interpretation: [{ text: lab.flag }],
    note: [{ text: `Source: ${lab.sourceLab || lab.source}. Name/LOINC mappings are candidate normalizations and should be validated by the receiving clinical system.` }],
  };
}
