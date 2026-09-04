import { NextResponse } from "next/server";
import type Stripe from "stripe";
import connectDB from "@/lib/db";
import { getStripe, planForPrices } from "@/lib/stripe";
import Subscription from "@/models/subscription";

export const runtime = "nodejs";

function periodEnd(subscription: Stripe.Subscription): Date | undefined {
  const timestamps = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  return timestamps.length ? new Date(Math.max(...timestamps) * 1000) : undefined;
}

async function persistSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
  const userId = subscription.metadata.clerkUserId || fallbackUserId;
  if (!userId) throw new Error(`Stripe subscription ${subscription.id} has no Clerk user ID`);

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { plan, basePriceId: priceId } = planForPrices(
    subscription.items.data.map((item) => item.price.id),
  );

  await Subscription.findOneAndUpdate(
    { userId },
    {
      $set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        plan,
        status: subscription.status,
        currentPeriodEnd: periodEnd(subscription),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook signature configuration is missing" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Rejected Stripe webhook", error);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    await connectDB();
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await persistSubscription(subscription, session.client_reference_id);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await persistSubscription(event.data.object);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Failed to process Stripe event ${event.id}`, error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
