import { aiModelConfig } from "./model-config";

export function normalizeReportText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, aiModelConfig.maxReportCharacters);
}

export function normalizeTargetLanguage(value: unknown) {
  if (typeof value !== "string") {
    return "English";
  }

  return value.trim().slice(0, 80) || "English";
}
