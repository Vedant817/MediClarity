/**
 * Canonical appointment lifecycle.
 *
 * scheduled  -> the visit is upcoming and holds the provider slot
 * attended   -> the patient showed up (terminal)
 * cancelled  -> called off by patient or clinic (terminal, frees the slot)
 * unattended -> visit date passed with no show (terminal, frees the slot)
 *
 * completed  -> legacy value written before the attended/unattended split.
 *               Reads normalize it to attended; new writes never use it.
 */
export const APPOINTMENT_STATUSES = [
  "scheduled",
  "attended",
  "cancelled",
  "unattended",
  "completed",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export type ActiveAppointmentStatus = "scheduled";
export type TerminalAppointmentStatus = "attended" | "cancelled" | "unattended";

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "attended",
  "cancelled",
  "unattended",
  "completed",
]);

/** Outcomes a patient can record for one of their visits. */
export const PATIENT_SETTABLE_STATUSES = [
  "attended",
  "cancelled",
  "unattended",
] as const;

export type PatientSettableStatus = (typeof PATIENT_SETTABLE_STATUSES)[number];

/** Legacy `completed` means the visit happened: read it as attended. */
export function normalizeAppointmentStatus(status: unknown): AppointmentStatus | null {
  if (status === "completed" || status === "attended") return "attended";
  if (status === "scheduled" || status === "cancelled" || status === "unattended") return status;
  return null;
}

export function isTerminalStatus(status: unknown): boolean {
  return typeof status === "string" && TERMINAL_STATUSES.has(status);
}

/**
 * Guard for patient-driven updates: only a currently-scheduled visit can
 * move to a terminal outcome, and terminal visits are immutable.
 */
export function canTransitionAppointmentStatus(from: unknown, to: unknown): boolean {
  if (from !== "scheduled") return false;
  return (
    to === "attended" || to === "cancelled" || to === "unattended"
  );
}
