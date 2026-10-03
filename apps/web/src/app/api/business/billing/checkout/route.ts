import { NextResponse } from "next/server";
import { connectToDatabase, createCheckoutSessionForOwner } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

/**
 * The self-service counterpart to the Admin-triggered checkout route.
 * Only reachable once Admin has flipped checkoutEnabled on for this
 * business — the billing page itself won't render the "Continue to
 * payment" link otherwise, but this route re-checks the flag server-side
 * so it can't be hit directly before that.
 */
export async function POST() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.business.checkoutEnabled) {
    return NextResponse.json({ status: "error", message: "Checkout isn't open for this account yet." }, { status: 403 });
  }
  if (session.business.billingAssignment === "group_pays") {
    return NextResponse.json(
      { status: "error", message: "This business is billed via its parent organization." },
      { status: 400 }
    );
  }

  const appUrl = process.env.APP_URL ?? "";
  const id = session.business._id.toString();

  await connectToDatabase();
  try {
    const url = await createCheckoutSessionForOwner({
      ownerType: "business",
      ownerId: id,
      successUrl: `${appUrl}/business/billing?checkout=success`,
      cancelUrl: `${appUrl}/business/billing?checkout=canceled`,
    });
    return NextResponse.json({ status: "ok", url });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
