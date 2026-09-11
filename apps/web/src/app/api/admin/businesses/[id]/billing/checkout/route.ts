import { NextResponse } from "next/server";
import { connectToDatabase, createCheckoutSessionForOwner, BillingError, CHECKOUT_PLANS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const CHECKOUT_PLAN_SET: readonly string[] = CHECKOUT_PLANS;

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Admin stands in for the Business/Group owner here — self-service checkout
 * through their own portal is a later milestone. Starts a Stripe Checkout
 * Session; the subscription itself isn't recorded until the
 * checkout.session.completed webhook fires.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.plan !== "string" || !CHECKOUT_PLAN_SET.includes(body.plan)) {
    return NextResponse.json({ status: "error", message: "A valid plan is required" }, { status: 400 });
  }

  const appUrl = process.env.APP_URL ?? "";

  await connectToDatabase();
  try {
    const url = await createCheckoutSessionForOwner({
      ownerType: "business",
      ownerId: id,
      plan: body.plan,
      successUrl: `${appUrl}/admin/businesses/${id}?checkout=success`,
      cancelUrl: `${appUrl}/admin/businesses/${id}?checkout=canceled`,
    });
    return NextResponse.json({ status: "ok", url });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ status: "error", message: err.message }, { status: 400 });
    }
    throw err;
  }
}
