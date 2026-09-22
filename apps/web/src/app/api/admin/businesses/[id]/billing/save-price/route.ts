import { NextResponse } from "next/server";
import { connectToDatabase, savePricingAndPushToStripe } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * The Pricing card's own "Save & push to Stripe" button — separate from
 * the big page Save, so changing a price doesn't require also saving every
 * other field, and immediately reaches Stripe if there's already an active
 * subscription to update, instead of sitting unapplied until the next
 * unrelated save.
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

  await connectToDatabase();
  try {
    const message = await savePricingAndPushToStripe("business", id, {
      amount: typeof body.amount === "number" ? body.amount : null,
      currency: typeof body.currency === "string" ? body.currency : "usd",
      interval: typeof body.interval === "string" ? body.interval : null,
    });
    return NextResponse.json({ status: "ok", message });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
