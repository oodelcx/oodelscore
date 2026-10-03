import { NextResponse } from "next/server";
import { connectToDatabase, savePricingAndPushToStripe, PRODUCTS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

const PRODUCT_SET: readonly string[] = PRODUCTS;

type RouteParams = { params: Promise<{ id: string }> };

/**
 * The Pricing card's own "Save & push to Stripe" button. For an org, a
 * saved price propagates to every branch already covered under its
 * subscription (repricing each one's own subscription item) — the org's
 * rate is the per-branch rate, not a separate org-level charge.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
  }

  const product = typeof body.product === "string" && PRODUCT_SET.includes(body.product) ? body.product : "customer_experience";

  await connectToDatabase();
  try {
    const message = await savePricingAndPushToStripe("parentOrg", id, product, {
      amount: typeof body.amount === "number" ? body.amount : null,
      currency: typeof body.currency === "string" ? body.currency : "usd",
      interval: typeof body.interval === "string" ? body.interval : null,
    });
    return NextResponse.json({ status: "ok", message });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
