import { NextResponse } from "next/server";
import { connectToDatabase, getStripeClient, handleStripeWebhookEvent } from "@oodelscore/shared";

export const runtime = "nodejs";

/**
 * Public endpoint — Stripe calls this directly, no session cookie. Auth is
 * the signature check below, not requireStaffSession. Register this URL
 * in Stripe Dashboard -> Developers -> Webhooks once deployed; the
 * resulting signing secret goes in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await request.text();

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  await connectToDatabase();

  try {
    await handleStripeWebhookEvent(event);
  } catch (err) {
    console.error("[stripe webhook] handler failed", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
