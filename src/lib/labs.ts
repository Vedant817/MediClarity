import { z } from "zod";

export const extractedLabSchema = z.object({
  test: z.string().trim().min(1).max(160),
  value: z.number().finite(),
  unit: z.string().trim().max(40).nullish(),
  refMin: z.number().finite().nullish(),
  refMax: z.number().finite().nullish(),
  flag: z.enum(["normal", "high", "low"]).nullish(),
  reportDate: z.string().trim().max(40).nullish(),
  source: z.string().trim().max(160).nullish(),
  sourceLab: z.string().trim().max(160).nullish(),
  sourceCountry: z.string().trim().max(80).nullish(),
});

export const extractedLabsSchema = z.array(extractedLabSchema).max(250);
export type ExtractedLab = z.infer<typeof extractedLabSchema>;

export type NormalizedLab = {
  test: string;
  canonicalName: string;
  value: number;
  unit?: string;
  refMin?: number;
  refMax?: number;
  flag: "normal" | "high" | "low" | "unknown";
  date: Date;
  source: string;
  sourceLab?: string;
  sourceCountry?: string;
  loinc?: string;
  original: {
    test: string;
    value: number;
    unit?: string;
    refMin?: number;
    refMax?: number;
  };
  referenceRangeSource: "lab_provided" | "not_provided";
  normalization: {
    version: "2026-08-31";
    aliasMatched: boolean;
    unitConverted: boolean;
    conversion?: string;
    loincMapping: "candidate_alias_map" | "none";
  };
};

type Definition = {
  canonicalName: string;
  aliases: string[];
  loinc?: string;
  canonicalUnit?: string;
  conversions?: Record<string, { factor: number; label: string }>;
};

const definitions: Definition[] = [
  { canonicalName: "Hemoglobin", aliases: ["hemoglobin", "haemoglobin", "hb", "hgb"], loinc: "718-7", canonicalUnit: "g/dL" },
  { canonicalName: "Glucose", aliases: ["glucose", "blood glucose", "fasting glucose", "fasting blood sugar", "fbs"], loinc: "2345-7", canonicalUnit: "mmol/L", conversions: { "mg/dl": { factor: 1 / 18.0182, label: "mg/dL to mmol/L (glucose)" } } },
  { canonicalName: "Total Cholesterol", aliases: ["cholesterol", "total cholesterol", "cholesterol total"], loinc: "2093-3", canonicalUnit: "mmol/L", conversions: { "mg/dl": { factor: 1 / 38.67, label: "mg/dL to mmol/L (cholesterol)" } } },
  { canonicalName: "LDL Cholesterol", aliases: ["ldl", "ldl-c", "ldl cholesterol"], loinc: "13457-7", canonicalUnit: "mmol/L", conversions: { "mg/dl": { factor: 1 / 38.67, label: "mg/dL to mmol/L (cholesterol)" } } },
  { canonicalName: "HDL Cholesterol", aliases: ["hdl", "hdl-c", "hdl cholesterol"], loinc: "2085-9", canonicalUnit: "mmol/L", conversions: { "mg/dl": { factor: 1 / 38.67, label: "mg/dL to mmol/L (cholesterol)" } } },
  { canonicalName: "Triglycerides", aliases: ["triglyceride", "triglycerides", "tg"], loinc: "2571-8", canonicalUnit: "mmol/L", conversions: { "mg/dl": { factor: 1 / 88.57, label: "mg/dL to mmol/L (triglycerides)" } } },
  { canonicalName: "Creatinine", aliases: ["creatinine", "serum creatinine"], loinc: "2160-0", canonicalUnit: "µmol/L", conversions: { "mg/dl": { factor: 88.4, label: "mg/dL to µmol/L (creatinine)" } } },
  { canonicalName: "Vitamin D", aliases: ["vitamin d", "25-oh vitamin d", "25 hydroxy vitamin d", "25(oh)d"], canonicalUnit: "nmol/L", conversions: { "ng/ml": { factor: 2.496, label: "ng/mL to nmol/L (25-hydroxy vitamin D)" } } },
  { canonicalName: "HbA1c", aliases: ["hba1c", "hemoglobin a1c", "haemoglobin a1c", "glycated hemoglobin"], loinc: "4548-4", canonicalUnit: "%" },
  { canonicalName: "TSH", aliases: ["tsh", "thyroid stimulating hormone"], loinc: "3016-3" },
  { canonicalName: "Platelets", aliases: ["platelet", "platelets", "platelet count", "plt"], loinc: "777-3" },
  { canonicalName: "White Blood Cell Count", aliases: ["white blood cell count", "white blood cells", "wbc", "wbc count"], loinc: "6690-2" },
];

const aliasMap = new Map(
  definitions.flatMap((definition) => definition.aliases.map((alias) => [alias, definition] as const)),
);

function normalizedName(value: string) {
  return value.toLowerCase().replace(/[._]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedUnit(value?: string | null) {
  if (!value) return undefined;
  return value
    .trim()
    .replace(/[μu]mol/gi, "µmol")
    .replace(/\s+/g, "")
    .replace(/lit(er|re)/gi, "L");
}

function unitKey(value?: string) {
  return value?.toLowerCase().replace("μ", "µ");
}

function finiteDate(value?: string | null, fallback = new Date()) {
  // Ambiguous locale dates (for example 01/02/2026) are deliberately rejected.
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

function rounded(value: number) {
  return Number(value.toPrecision(8));
}

export function normalizeLab(lab: ExtractedLab, fallbackDate = new Date()): NormalizedLab {
  const definition = aliasMap.get(normalizedName(lab.test));
  const originalUnit = normalizedUnit(lab.unit);
  const conversion = definition?.conversions?.[unitKey(originalUnit) ?? ""];
  const shouldConvert = Boolean(conversion && definition?.canonicalUnit);
  const factor = conversion?.factor ?? 1;
  const refMin = lab.refMin == null ? undefined : rounded(lab.refMin * factor);
  const refMax = lab.refMax == null ? undefined : rounded(lab.refMax * factor);
  const value = rounded(lab.value * factor);

  // A printed numeric range is deterministic and wins over a potentially
  // inconsistent extracted flag. A source flag is used only when no numeric
  // interval was printed; otherwise the state remains explicitly unknown.
  const flag = refMin != null && value < refMin
    ? "low"
    : refMax != null && value > refMax
      ? "high"
      : refMin != null || refMax != null
        ? "normal"
        : lab.flag ?? "unknown";

  return {
    test: lab.test,
    canonicalName: definition?.canonicalName ?? lab.test.trim(),
    value,
    unit: shouldConvert ? definition?.canonicalUnit : originalUnit,
    refMin,
    refMax,
    flag,
    date: finiteDate(lab.reportDate, fallbackDate),
    source: lab.source?.trim() || "ocr",
    sourceLab: lab.sourceLab?.trim() || undefined,
    sourceCountry: lab.sourceCountry?.trim() || undefined,
    loinc: definition?.loinc,
    original: {
      test: lab.test,
      value: lab.value,
      unit: originalUnit,
      refMin: lab.refMin ?? undefined,
      refMax: lab.refMax ?? undefined,
    },
    referenceRangeSource: lab.refMin != null || lab.refMax != null ? "lab_provided" : "not_provided",
    normalization: {
      version: "2026-08-31",
      aliasMatched: Boolean(definition),
      unitConverted: shouldConvert,
      conversion: conversion?.label,
      loincMapping: definition?.loinc ? "candidate_alias_map" : "none",
    },
  };
}

export function normalizeLabs(labs: ExtractedLab[], fallbackDate = new Date()) {
  return labs.map((lab) => normalizeLab(lab, fallbackDate));
}

export function parseJsonArray(text: string): unknown {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = unfenced.indexOf("[");
  const end = unfenced.lastIndexOf("]");
  if (start === -1 || end < start) throw new Error("Model response did not contain a JSON array");
  return JSON.parse(unfenced.slice(start, end + 1));
}
