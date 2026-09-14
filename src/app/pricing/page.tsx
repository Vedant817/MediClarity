import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, Check } from "lucide-react";
import { BillingButton } from "@/components/BillingButton";
import { Button } from "@/components/ui/button";
import { getPlanDisplay } from "@/config/pricing-display";
import { getEntitlements } from "@/lib/entitlements";

/**
 * Authenticated plan purchase page. Logged-in users land here after
 * signing in to buy (instead of being dropped on the dashboard), and
 * every in-app "Compare plans / View plans" link points here instead of
 * the marketing anchor. Logged-out visitors are bounced to login first
 * and return here afterwards.
 */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect(`/login?redirect_url=${encodeURIComponent("/pricing")}`);

  const [{ billing }, entitlements] = await Promise.all([
    searchParams,
    getEntitlements(userId),
  ]);
  const currentPlan = entitlements.plan;
  const plans = getPlanDisplay();

  return (
    <main className="min-h-screen bg-[#f7f3e9] text-[#102c2a]">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-mono text-sm text-[#0b766e] underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to dashboard
        </Link>
        <div className="mt-6 max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0b766e]">
            Plans & billing
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Choose the plan that fits your record.
          </h1>
          <p className="mt-4 text-[#526864]">
            Current plan: <strong className="capitalize">{currentPlan}</strong>.
            Recurring plans are managed through Stripe.
          </p>
        </div>

        {billing === "cancelled" && (
          <p className="mt-6 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
            Checkout was cancelled. No charge was made — pick a plan below whenever you are ready.
          </p>
        )}

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent =
              (plan.action === "free" && currentPlan === "free") || plan.action === currentPlan;
            return (
              <article
                key={plan.name}
                className={`flex flex-col rounded-2xl border p-7 ${
                  plan.name === "Pro"
                    ? "border-[#0b766e] bg-[#fffdf7] shadow-[7px_7px_0_#0b766e]"
                    : "border-[#102c2a]/20 bg-[#fffdf7]"
                }`}
              >
                <p className="font-mono text-xs uppercase tracking-widest text-[#0b766e]">{plan.name}</p>
                <div className="mt-5 flex items-end gap-2">
                  <span className="text-5xl font-semibold tracking-tight">{plan.price}</span>
                  <span className="pb-1 text-sm text-[#687c78]">{plan.suffix}</span>
                </div>
                <p className="mt-4 text-sm text-[#526864]">{plan.description}</p>
                <ul className="my-7 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#0b766e]" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <p className="w-full rounded-md border border-[#0b766e]/40 bg-[#0b766e]/10 px-4 py-2 text-center text-sm font-semibold text-[#0b766e]">
                    Current plan
                  </p>
                ) : plan.action === "free" ? (
                  <Button asChild variant="outline" className="w-full border-[#102c2a]/30">
                    <Link href="/dashboard">Continue with Free</Link>
                  </Button>
                ) : (
                  <BillingButton plan={plan.action}>Choose {plan.name}</BillingButton>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-[#526864]">
          Need invoices, payment methods, or cancellation?{" "}
          <Link className="font-semibold text-[#0b766e] underline" href="/dashboard/settings">
            Manage billing in settings
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
