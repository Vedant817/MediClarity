import { describe, expect, it } from "vitest";
import {
  extractRepairJson,
  recoverReportPrecautionRequest,
} from "../src/transcript-repair";

describe("spoken transcript repair", () => {
  it("recovers a garbled last-reports-and-precautions request", () => {
    const heard = "Three to five or four motrophs. And 10, five, last three or four reports. If nine women tell me the precautions in which I should take?";
    expect(recoverReportPrecautionRequest(heard)).toBe(
      "Based on my last three or four reports, what precautions should I take?",
    );
  });

  it("does not invent that intent when reports or precautions are missing", () => {
    expect(recoverReportPrecautionRequest("What is my next appointment?")).toBeNull();
    expect(recoverReportPrecautionRequest("Tell me the precautions")).toBeNull();
  });

  it("parses a repair JSON payload from model output", () => {
    expect(extractRepairJson('Sure. {"cleaned":"What was my HbA1c?","confident":true}')).toEqual({
      cleaned: "What was my HbA1c?",
      confident: true,
    });
    expect(extractRepairJson('{"cleaned":"","confident":false}')).toBeNull();
  });
});
