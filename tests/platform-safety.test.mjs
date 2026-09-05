import test from "node:test";
import assert from "node:assert/strict";
import { File } from "node:buffer";
import {
  appointmentTimeVariants,
  isCanonicalAppointmentDate,
  normalizeAppointmentTime,
} from "../src/lib/appointment-slot.ts";
import { labToFhirObservation } from "../src/lib/fhir.ts";
import { isValidShareToken } from "../src/lib/share-token.ts";
import { applyDeterministicSafetyRules, triageInputSchema } from "../src/lib/triage.ts";
import {
  assertOwnedCloudinaryDocumentUrl,
  safeUploadFileName,
  validateReportFile,
} from "../src/lib/upload-security.ts";

test("appointment dates and legacy times normalize without accepting impossible dates", () => {
  assert.equal(isCanonicalAppointmentDate("2028-02-29"), true);
  assert.equal(isCanonicalAppointmentDate("2027-02-29"), false);
  assert.equal(isCanonicalAppointmentDate("09/05/2026"), false);
  assert.equal(normalizeAppointmentTime("12:05 AM"), "00:05");
  assert.equal(normalizeAppointmentTime("12:05 PM"), "12:05");
  assert.deepEqual(appointmentTimeVariants("18:30"), ["18:30", "6:30 PM"]);
});

test("emergency symptom pairs override a falsely reassuring model response", () => {
  const input = triageInputSchema.parse({ symptoms: ["chest pain", "shortness of breath"] });
  const result = applyDeterministicSafetyRules(input, {
    urgency: "low",
    timeframe: "several weeks",
    specialist: "General medicine",
    redFlags: [],
    selfCare: ["Rest"],
    disclaimer: "model text",
  });

  assert.equal(result.urgency, "high");
  assert.equal(result.timeframe, "Seek emergency care now");
  assert.match(result.redFlags[0], /emergency number/i);
  assert.match(result.disclaimer, /not medical advice/i);
});

test("FHIR observations retain source provenance and candidate LOINC coding", () => {
  const observation = labToFhirObservation({
    test: "Hb",
    canonicalName: "Hemoglobin",
    seriesKey: "hemoglobin:g/dL",
    value: 13.2,
    unit: "g/dL",
    refMin: 12,
    refMax: 15,
    flag: "normal",
    date: new Date("2026-09-01T00:00:00.000Z"),
    loinc: "718-7",
    source: "ocr",
    sourceLab: "Example Lab",
    sourceCountry: "IN",
    referenceRangeSource: "lab_provided",
    original: { test: "Hb", value: 13.2, unit: "g/dL", refMin: 12, refMax: 15 },
    normalization: { version: "test", nameMapped: true, unitConverted: false },
  });

  assert.equal(observation.code.coding[0].code, "718-7");
  assert.equal(observation.valueQuantity.value, 13.2);
  assert.match(observation.note[0].text, /Example Lab/);
});

test("upload validation checks both declared type and file signature", async () => {
  const validPdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], "report.pdf", { type: "application/pdf" });
  await assert.doesNotReject(validateReportFile(validPdf));

  const disguisedPdf = new File([new Uint8Array([0x47, 0x49, 0x46])], "report.pdf", { type: "application/pdf" });
  await assert.rejects(validateReportFile(disguisedPdf), /do not match/);
  assert.equal(safeUploadFileName("../Patient Report (final).pdf"), "Patient-Report--final-.pdf");
});

test("document URLs must belong to the configured Cloudinary deployment", () => {
  const previous = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = "mediclarity-test";
  try {
    assert.equal(
      assertOwnedCloudinaryDocumentUrl("https://res.cloudinary.com/mediclarity-test/image/upload/report.pdf").hostname,
      "res.cloudinary.com",
    );
    assert.throws(() => assertOwnedCloudinaryDocumentUrl("https://example.com/report.pdf"), /MediClarity Cloudinary/);
    assert.throws(() => assertOwnedCloudinaryDocumentUrl("https://res.cloudinary.com/other/image/upload/report.pdf"), /not owned/);
  } finally {
    if (previous === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = previous;
  }
});

test("public share tokens must match the generated base64url shape", () => {
  assert.equal(isValidShareToken("a".repeat(43)), true);
  assert.equal(isValidShareToken("not-a-real-token"), false);
  assert.equal(isValidShareToken(`${"a".repeat(42)}=`), false);
  assert.equal(isValidShareToken(undefined), false);
});
