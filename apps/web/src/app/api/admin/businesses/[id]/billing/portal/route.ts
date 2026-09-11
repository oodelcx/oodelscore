import { NextResponse } from "next/server";
import { connectToDatabase, createBillingPortalSession, BillingSubscription } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();

  const subscription = await BillingSubscription.findOne({ ownerType: "business", ownerId: id });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ status: "error", message: "No Stripe customer on file yet" }, { status: 404 });
  }

  const appUrl = process.env.APP_URL ?? "";
  const url = await createBillingPortalSession(subscription.stripeCustomerId, `${appUrl}/admin/businesses/${id}`);
  return NextResponse.json({ status: "ok", url });
}
