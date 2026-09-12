import { NextResponse } from "next/server";
import { connectToDatabase, BillingSubscription, Invoice, FeedbackPoint, Response } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [subscription, invoices, feedbackPointCount, responseCount] = await Promise.all([
    BillingSubscription.findOne({ ownerType: "business", ownerId: session.business._id }),
    Invoice.find({ ownerType: "business", ownerId: session.business._id }).sort({ issuedAt: -1 }).limit(12),
    FeedbackPoint.countDocuments({ businessId: session.business._id }),
    Response.countDocuments({ businessId: session.business._id }),
  ]);

  return NextResponse.json({
    status: "ok",
    subscription,
    invoices,
    usage: {
      feedbackPointsUsed: feedbackPointCount,
      feedbackPointsAllowed: session.business.maxFeedbackPoints,
      responseCount,
    },
    billingAssignment: session.business.billingAssignment,
  });
}
