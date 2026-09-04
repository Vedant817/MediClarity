import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getAppUrl, getStripe } from "@/lib/stripe";
import Subscription from "@/models/subscription";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const subscription = await Subscription.findOne({ userId }).lean<{ stripeCustomerId?: string }>();
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account exists for this user" }, { status: 404 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getAppUrl()}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Unable to create Stripe portal session", error);
    return NextResponse.json({ error: "Billing is temporarily unavailable" }, { status: 503 });
  }
}
