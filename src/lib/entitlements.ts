import connectDB from "@/lib/db";
import Subscription, { type BillingPlan } from "@/models/subscription";
import { PRODUCT_CATALOG } from "@/config/product";

export type Entitlements = {
  plan: BillingPlan;
  maxReportsPerMonth: number | null;
  trends: boolean;
  share: boolean;
  medications: boolean;
  education: boolean;
  triage: boolean;
  api: boolean;
};

const FREE_ENTITLEMENTS: Entitlements = {
  plan: "free",
  maxReportsPerMonth: PRODUCT_CATALOG.free.maxReportsPerMonth,
  trends: false,
  share: false,
  medications: false,
  education: false,
  triage: false,
  api: false,
};

const ENTITLEMENTS: Record<BillingPlan, Entitlements> = {
  free: FREE_ENTITLEMENTS,
  pro: {
    plan: "pro",
    maxReportsPerMonth: PRODUCT_CATALOG.pro.maxReportsPerMonth,
    trends: true,
    share: true,
    medications: true,
    education: true,
    triage: true,
    api: false,
  },
  lab: {
    plan: "lab",
    maxReportsPerMonth: PRODUCT_CATALOG.lab.maxReportsPerMonth,
    trends: true,
    share: true,
    medications: true,
    education: true,
    triage: true,
    api: true,
  },
};

const ACCESS_STATUSES = new Set(["active", "trialing"]);

export async function getEntitlements(userId: string): Promise<Entitlements> {
  if (!userId) return { ...FREE_ENTITLEMENTS };

  try {
    await connectDB();
    const subscription = await Subscription.findOne({ userId }).lean<{
      plan?: BillingPlan;
      status?: string;
      currentPeriodEnd?: Date;
    }>();

    if (!subscription?.plan || !ACCESS_STATUSES.has(subscription.status ?? "")) {
      return { ...FREE_ENTITLEMENTS };
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
      return { ...FREE_ENTITLEMENTS };
    }
    return { ...ENTITLEMENTS[subscription.plan] };
  } catch (error) {
    console.error("Entitlement lookup failed; applying the free plan", error);
    return { ...FREE_ENTITLEMENTS };
  }
}
