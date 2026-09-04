import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import connectDB from "@/lib/db";
import { getAppUrl, getCheckoutPriceIds, getStripe, validateBillingCatalog } from "@/lib/stripe";
import Subscription from "@/models/subscription";

const CheckoutRequest = z.object({ plan: z.enum(["pro", "lab"]) });

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CheckoutRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Plan must be pro or lab" }, { status: 400 });
  }

  try {
    await connectDB();
    const stripe = getStripe();
    await validateBillingCatalog(parsed.data.plan);
    const existing = await Subscription.findOne({ userId });
    if (existing && ["active", "trialing"].includes(existing.status)) {
      return NextResponse.json(
        { error: "An active plan already exists. Manage it from the billing portal." },
        { status: 409 },
      );
    }
    let customerId = existing?.stripeCustomerId as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { clerkUserId: userId } });
      customerId = customer.id;
      await Subscription.findOneAndUpdate(
        { userId },
        { $set: { stripeCustomerId: customerId }, $setOnInsert: { plan: "free", status: "inactive" } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    const appUrl = getAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: getCheckoutPriceIds(parsed.data.plan).map((price, index) =>
        parsed.data.plan === "lab" && index === 1 ? { price } : { price, quantity: 1 },
      ),
      allow_promotion_codes: true,
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/#pricing`,
      client_reference_id: userId,
      metadata: { clerkUserId: userId, plan: parsed.data.plan },
      subscription_data: { metadata: { clerkUserId: userId, plan: parsed.data.plan } },
    });

    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Unable to create Stripe Checkout session", error);
    return NextResponse.json({ error: "Billing is temporarily unavailable" }, { status: 503 });
  }
}
