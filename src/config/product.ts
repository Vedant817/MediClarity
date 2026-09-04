/**
 * Versioned commercial policy used by both the UI and server enforcement.
 * Stripe IDs remain deployment configuration; these values describe what
 * those prices are expected to represent.
 */
export const PRODUCT_CATALOG = {
  currency: "usd",
  free: {
    name: "Free",
    monthlyPriceCents: 0,
    maxReportsPerMonth: 3,
  },
  pro: {
    name: "Pro",
    monthlyPriceCents: 1_900,
    maxReportsPerMonth: null,
  },
  lab: {
    name: "Lab API",
    monthlyPriceCents: 9_900,
    usagePriceCents: 5,
    maxReportsPerMonth: null,
  },
} as const;

export const API_LIMITS = {
  requestsPerMinute: 10,
  defaultMonthlyQuota: 2_000,
  maxActiveKeysPerAccount: 5,
  usageWindowRetentionDays: 2,
} as const;

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: PRODUCT_CATALOG.currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
