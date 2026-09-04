import mongoose, { Schema } from "mongoose";

export const BILLING_PLANS = ["free", "pro", "lab"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

const SubscriptionSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    stripeCustomerId: { type: String, unique: true, sparse: true, index: true },
    stripeSubscriptionId: { type: String, unique: true, sparse: true, index: true },
    stripePriceId: { type: String },
    plan: { type: String, enum: BILLING_PLANS, default: "free", required: true },
    status: { type: String, default: "inactive", required: true },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.models.Subscription ||
  mongoose.model("Subscription", SubscriptionSchema);
