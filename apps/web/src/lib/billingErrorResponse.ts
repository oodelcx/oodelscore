import { NextResponse } from "next/server";
import { BillingError } from "@oodelscore/shared";

/**
 * Every Stripe-touching admin route wraps its Stripe/DB call in a try/catch
 * that calls this. Without it, a raw Stripe API error (bad key, bad price
 * ID, account restriction, etc.) is an uncaught exception — Next.js turns
 * that into an HTML error page, which the frontend's `res.json()` can't
 * parse, so the user sees only a generic "Failed to..." fallback with no
 * indication of what actually broke. This always returns real JSON with
 * the actual message instead, and logs server-side for anything unexpected.
 */
export function billingErrorResponse(err: unknown) {
  if (err instanceof BillingError) {
    return NextResponse.json({ status: "error", message: err.message }, { status: 400 });
  }
  console.error("[billing]", err);
  const message = err instanceof Error ? err.message : "Unexpected error";
  return NextResponse.json({ status: "error", message }, { status: 500 });
}
