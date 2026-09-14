import { formatUsd, PRODUCT_CATALOG } from "@/config/product";
import type { BillingPlan } from "@/models/subscription";

export type PlanAction = Exclude<BillingPlan, "free"> | "free";

export type PlanDisplay = {
  name: string;
  price: string;
  suffix: string;
  description: string;
  features: string[];
  action: PlanAction;
};

/**
 * Single source of truth for plan cards shown on the marketing landing
 * page and the authenticated /pricing page. Prices come from the product
 * catalog so Stripe and the UI cannot drift apart.
 */
export function getPlanDisplay(): PlanDisplay[] {
  return [
    {
      name: PRODUCT_CATALOG.free.name,
      price: formatUsd(PRODUCT_CATALOG.free.monthlyPriceCents),
      suffix: "forever",
      description: "Understand an occasional report.",
      features: [
        `${PRODUCT_CATALOG.free.maxReportsPerMonth} reports each month`,
        "Patient-friendly summary",
        "Report Q&A",
      ],
      action: "free",
    },
    {
      name: PRODUCT_CATALOG.pro.name,
      price: formatUsd(PRODUCT_CATALOG.pro.monthlyPriceCents),
      suffix: "per month",
      description: "Build a longitudinal health record.",
      features: ["Unlimited reports", "Trends and normalized results", "Share, medications, and education"],
      action: "pro",
    },
    {
      name: PRODUCT_CATALOG.lab.name,
      price: formatUsd(PRODUCT_CATALOG.lab.monthlyPriceCents),
      suffix: "per month",
      description: "Structure reports for your product or lab.",
      features: [
        "API keys and usage dashboard",
        "Lab rows and FHIR output",
        `${formatUsd(PRODUCT_CATALOG.lab.usagePriceCents)} per processed report`,
      ],
      action: "lab",
    },
  ];
}
