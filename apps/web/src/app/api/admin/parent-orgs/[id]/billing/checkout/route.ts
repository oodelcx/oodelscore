import { NextResponse } from "next/server";
import { connectToDatabase, createCheckoutSessionForOwner } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Starts a Stripe Checkout Session priced from whatever Admin has already
 * set in this org's own pricingTerms (see PATCH .../parent-orgs/[id]) — the
 * subscription itself isn't recorded until the checkout.session.completed
 * webhook fires.
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
      ownerType: "parentOrg",
      ownerId: id,
      successUrl: `${appUrl}/admin/parent-orgs/${id}?checkout=success`,
      cancelUrl: `${appUrl}/admin/parent-orgs/${id}?checkout=canceled`,
    });
    return NextResponse.json({ status: "ok", url });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
