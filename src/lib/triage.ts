import { z } from "zod";

export const triageInputSchema = z.object({
  symptoms: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  age: z.number().int().min(0).max(120).optional(),
  sex: z.enum(["female", "male", "intersex", "prefer-not-to-say"]).optional(),
  abnormalLabs: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
});

export const triageResultSchema = z.object({
  urgency: z.enum(["low", "medium", "high"]),
  timeframe: z.string().min(1).max(80),
  specialist: z.string().min(1).max(120),
  redFlags: z.array(z.string().max(240)).max(10),
  selfCare: z.array(z.string().max(240)).max(10),
  disclaimer: z.string(),
});

export type TriageInput = z.infer<typeof triageInputSchema>;
export type TriageResult = z.infer<typeof triageResultSchema>;

export const TRIAGE_RULESET_VERSION = "2026-09-01";

const emergencyPairs = [
  ["chest pain", "shortness of breath"],
  ["chest pain", "fainting"],
  ["weakness", "slurred speech"],
];

export function hasEmergencySignal(input: TriageInput): boolean {
  const symptoms = input.symptoms.map((symptom) => symptom.toLowerCase());
  return emergencyPairs.some((pair) => pair.every((term) => symptoms.some((value) => value.includes(term))));
}

export function applyDeterministicSafetyRules(input: TriageInput, result: TriageResult): TriageResult {
  const symptoms = input.symptoms.map((symptom) => symptom.toLowerCase());
  const matchesEmergencyPair = hasEmergencySignal(input);
  if (!matchesEmergencyPair) {
    return { ...result, disclaimer: "For information only, not medical advice or a diagnosis." };
  }

  return {
    ...result,
    urgency: "high",
    timeframe: "Seek emergency care now",
    specialist: pairSpecialist(symptoms),
    redFlags: Array.from(new Set([
      "Call your local emergency number now if symptoms are current, severe, worsening, or accompanied by sweating, fainting, confusion, or blue lips.",
      ...result.redFlags,
    ])),
    selfCare: ["Do not drive yourself if symptoms are severe. Follow instructions from local emergency services."],
    disclaimer: "For information only, not medical advice or a diagnosis.",
  };
}

function pairSpecialist(symptoms: string[]): string {
  return symptoms.some((value) => value.includes("chest pain")) ? "Emergency care / Cardiology" : "Emergency care / Neurology";
}
