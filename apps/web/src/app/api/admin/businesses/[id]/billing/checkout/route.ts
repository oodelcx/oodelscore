import { NextResponse } from "next/server";
import { connectToDatabase, createCheckoutSessionForOwner } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Admin stands in for the Business/Group owner here — self-service checkout
 * through their own portal is /billing/activate instead, once the account
 * is gated on payment. Starts a Stripe Checkout Session priced from
 * whatever Admin has already set in this business's own pricingTerms (see
 * PATCH .../businesses/[id]) — the subscription itself isn't recorded
 * until the checkout.session.completed webhook fires.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const appUrl = process.env.APP_URL ?? "";

  await connectToDatabase();
  try {
    const url = await createCheckoutSessionForOwner({
      ownerType: "business",
      ownerId: id,
      successUrl: `${appUrl}/admin/businesses/${id}?checkout=success`,
      cancelUrl: `${appUrl}/admin/businesses/${id}?checkout=canceled`,
    });
    return NextResponse.json({ status: "ok", url });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
