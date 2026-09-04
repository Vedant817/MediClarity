import mongoose from "mongoose";
import { isCanonicalAppointmentDate, isCanonicalAppointmentTime, normalizeAppointmentTime } from "@/lib/appointment-slot";
import { appointmentTypeIds } from "@/lib/data";

const AppointmentSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  providerId: { type: String, required: true },
  appointmentType: { type: String, required: true, enum: appointmentTypeIds },
  date: {
    type: String,
    required: true,
    validate: { validator: isCanonicalAppointmentDate, message: "Appointment date must be a valid YYYY-MM-DD date" },
  },
  time: {
    type: String,
    required: true,
    set: normalizeAppointmentTime,
    validate: { validator: isCanonicalAppointmentTime, message: "Appointment time must be one of the configured time slots" },
  },
  reason: { type: String, required: true },
  preVisitRequirements: { type: [String], default: [] },
  status: { type: String, default: "scheduled" },
  reminderSent: { type: Boolean, default: false },
  reminderSentAt: { type: Date },
  followUpSent: { type: Boolean, default: false },
  followUpSentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

AppointmentSchema.pre("save", function setNotificationTimestamps(next) {
  if (this.isModified("reminderSent") && this.reminderSent && !this.reminderSentAt) {
    this.reminderSentAt = new Date();
  }
  if (this.isModified("followUpSent") && this.followUpSent && !this.followUpSentAt) {
    this.followUpSentAt = new Date();
  }
  next();
});

AppointmentSchema.index({ patientId: 1, date: -1 });
// Audit duplicate scheduled slots before syncing this index on a legacy DB.
AppointmentSchema.index(
  { providerId: 1, date: 1, time: 1 },
  { unique: true, partialFilterExpression: { status: "scheduled" }, name: "uniq_scheduled_provider_slot" },
);
const Appointment =
  mongoose.models.Appointment ||
  mongoose.model("Appointment", AppointmentSchema);

export default Appointment;
