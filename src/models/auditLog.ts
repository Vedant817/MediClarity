import mongoose, { Schema } from "mongoose";

export type AuditAction = "view" | "share" | "download" | "revoke";

export interface IAuditLog {
  actorId?: string;
  action: AuditAction;
  resourceId: string;
  resourceType: "report" | "lab" | "share";
  ipHash?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: String, index: true },
    action: { type: String, enum: ["view", "share", "download", "revoke"], required: true, index: true },
    resourceId: { type: String, required: true, index: true },
    resourceType: { type: String, enum: ["report", "lab", "share"], required: true },
    ipHash: String,
    userAgent: { type: String, maxlength: 512 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ resourceId: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
