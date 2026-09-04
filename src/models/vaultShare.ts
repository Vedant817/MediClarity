import mongoose, { Schema } from "mongoose";

export interface IVaultShare {
  reportId: mongoose.Types.ObjectId;
  ownerId: string;
  sharedWithEmail?: string;
  tokenHash: string;
  role: "viewer";
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const VaultShareSchema = new Schema<IVaultShare>(
  {
    reportId: { type: Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    sharedWithEmail: { type: String, trim: true, lowercase: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ["viewer"], default: "viewer" },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

VaultShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VaultShare: mongoose.Model<IVaultShare> =
  (mongoose.models.VaultShare as mongoose.Model<IVaultShare> | undefined) ||
  mongoose.model<IVaultShare>("VaultShare", VaultShareSchema);

export default VaultShare;
