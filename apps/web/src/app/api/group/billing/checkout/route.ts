import { NextResponse } from "next/server";
import { connectToDatabase, createCheckoutSessionForOwner } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

/**
 * The self-service counterpart to the Admin-triggered checkout route.
 * Only reachable once Admin has flipped checkoutEnabled on for this org.
 */
export async function POST() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.org.checkoutEnabled) {
    return NextResponse.json({ status: "error", message: "Checkout isn't open for this account yet." }, { status: 403 });
  }

  const appUrl = process.env.APP_URL ?? "";
  const id = session.org._id.toString();

  await connectToDatabase();
  try {
    const url = await createCheckoutSessionForOwner({
      ownerType: "parentOrg",
      ownerId: id,
      successUrl: `${appUrl}/group/billing?checkout=success`,
      cancelUrl: `${appUrl}/group/billing?checkout=canceled`,
    });
    return NextResponse.json({ status: "ok", url });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
