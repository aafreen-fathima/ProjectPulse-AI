import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-09-30.acacia" });

const PRICE_TO_PLAN: Record<string, "starter" | "growth" | "enterprise"> = {
  [process.env.STRIPE_PRICE_STARTER!]:    "starter",
  [process.env.STRIPE_PRICE_GROWTH!]:     "growth",
  [process.env.STRIPE_PRICE_ENTERPRISE!]: "enterprise",
};

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) return new NextResponse("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new NextResponse(`bad signature: ${(err as Error).message}`, { status: 400 });
  }

  const sb = supabaseAdmin();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.client_reference_id;
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = sub.items.data[0]?.price.id;
      const plan = priceId ? PRICE_TO_PLAN[priceId] : null;
      if (orgId && plan) {
        await sb.from("orgs").update({ plan }).eq("id", orgId);
        await sb.from("users").update({ plan }).eq("org_id", orgId);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = (sub.metadata as Record<string, string>).org_id;
      if (orgId) {
        await sb.from("orgs").update({ plan: "starter" }).eq("id", orgId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
