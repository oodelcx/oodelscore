import { NextResponse } from "next/server";
import { connectToDatabase, createBillingPortalSession, BillingSubscription } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

export async function POST() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const subscription = await BillingSubscription.findOne({ ownerType: "parentOrg", ownerId: session.org._id });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ status: "error", message: "No Stripe customer on file yet" }, { status: 404 });
  }

  try {
    const appUrl = process.env.APP_URL ?? "";
    const url = await createBillingPortalSession(subscription.stripeCustomerId, `${appUrl}/group/billing`);
    return NextResponse.json({ status: "ok", url });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
