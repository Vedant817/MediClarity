import Stripe from "stripe";
import type { BillingPlan } from "@/models/subscription";
import { PRODUCT_CATALOG } from "@/config/product";

let stripeClient: Stripe | null = null;
const catalogValidations = new Map<string, Promise<void>>();

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  stripeClient ??= new Stripe(secretKey, { typescript: true });
  return stripeClient;
}

export function getAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  }
  return "http://localhost:3000";
}

export function getPriceId(plan: Exclude<BillingPlan, "free">): string {
  const priceId =
    plan === "pro" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_LAB_PRICE_ID;
  if (!priceId) throw new Error(`Stripe price for ${plan} is not configured`);
  return priceId;
}

export function getCheckoutPriceIds(plan: Exclude<BillingPlan, "free">): string[] {
  if (plan === "pro") return [getPriceId("pro")];
  const usagePriceId = process.env.STRIPE_LAB_USAGE_PRICE_ID;
  if (!usagePriceId) throw new Error("STRIPE_LAB_USAGE_PRICE_ID is not configured");
  return [getPriceId("lab"), usagePriceId];
}

type CatalogPriceExpectation = {
  id: string;
  amount: number;
  usageType: "licensed" | "metered";
  label: string;
};

async function assertStripePrice(expectation: CatalogPriceExpectation): Promise<void> {
  const price = await getStripe().prices.retrieve(expectation.id);
  if (!price.active) throw new Error(`${expectation.label} Stripe price is inactive`);
  if (price.currency !== PRODUCT_CATALOG.currency) {
    throw new Error(`${expectation.label} Stripe price must use ${PRODUCT_CATALOG.currency.toUpperCase()}`);
  }
  if (price.unit_amount !== expectation.amount) {
    throw new Error(`${expectation.label} Stripe price amount does not match the product catalog`);
  }
  if (price.type !== "recurring" || price.recurring?.interval !== "month") {
    throw new Error(`${expectation.label} Stripe price must recur monthly`);
  }
  if (price.recurring.usage_type !== expectation.usageType) {
    throw new Error(`${expectation.label} Stripe price must use ${expectation.usageType} usage`);
  }
}

/** Fail checkout before creating a customer when Stripe and the public catalog drift. */
export function validateBillingCatalog(plan: Exclude<BillingPlan, "free">): Promise<void> {
  const cacheKey = `${plan}:${getCheckoutPriceIds(plan).join(":")}`;
  const existing = catalogValidations.get(cacheKey);
  if (existing) return existing;

  const validation = plan === "pro"
    ? assertStripePrice({ id: getPriceId("pro"), amount: PRODUCT_CATALOG.pro.monthlyPriceCents, usageType: "licensed", label: "Pro" })
    : Promise.all([
        assertStripePrice({ id: getPriceId("lab"), amount: PRODUCT_CATALOG.lab.monthlyPriceCents, usageType: "licensed", label: "Lab base" }),
        assertStripePrice({ id: process.env.STRIPE_LAB_USAGE_PRICE_ID!, amount: PRODUCT_CATALOG.lab.usagePriceCents, usageType: "metered", label: "Lab usage" }),
      ]).then(() => undefined);
  catalogValidations.set(cacheKey, validation);
  validation.catch(() => catalogValidations.delete(cacheKey));
  return validation;
}

export async function recordLabUsage(customerId: string, reportEventId: string): Promise<void> {
  const eventName = process.env.STRIPE_LAB_METER_EVENT_NAME;
  if (!eventName) throw new Error("STRIPE_LAB_METER_EVENT_NAME is not configured");
  await getStripe().billing.meterEvents.create({
    event_name: eventName,
    identifier: reportEventId,
    payload: { stripe_customer_id: customerId, value: "1" },
  });
}

export function planForPrices(priceIds: Array<string | null | undefined>): {
  plan: Exclude<BillingPlan, "free">;
  basePriceId: string;
} {
  const ids = new Set(priceIds.filter((value): value is string => Boolean(value)));
  const labPriceId = process.env.STRIPE_LAB_PRICE_ID;
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  if (labPriceId && ids.has(labPriceId)) return { plan: "lab", basePriceId: labPriceId };
  if (proPriceId && ids.has(proPriceId)) return { plan: "pro", basePriceId: proPriceId };
  throw new Error("Stripe subscription contains no configured base plan price");
}
