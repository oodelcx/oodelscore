import { NextResponse } from "next/server";
import { connectToDatabase, createBillingPortalSession, BillingSubscription } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

export async function POST() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (session.business.billingAssignment === "group_pays") {
    return NextResponse.json(
      { status: "error", message: "This business is billed via its parent organization — contact them for billing changes" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const subscription = await BillingSubscription.findOne({ ownerType: "business", ownerId: session.business._id });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ status: "error", message: "No Stripe customer on file yet" }, { status: 404 });
  }

  try {
    const appUrl = process.env.APP_URL ?? "";
    const url = await createBillingPortalSession(subscription.stripeCustomerId, `${appUrl}/business/billing`);
    return NextResponse.json({ status: "ok", url });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
