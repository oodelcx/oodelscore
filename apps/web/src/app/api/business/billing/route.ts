import { NextResponse } from "next/server";
import { connectToDatabase, BillingSubscription, Invoice, FeedbackPoint, Response, ParentOrganization, Business } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [subscription, invoices, feedbackPointCount, responseCount, parentOrg] = await Promise.all([
    BillingSubscription.findOne({ ownerType: "business", ownerId: session.business._id }),
    Invoice.find({ ownerType: "business", ownerId: session.business._id }).sort({ issuedAt: -1 }).limit(12),
    FeedbackPoint.countDocuments({ businessId: session.business._id }),
    Response.countDocuments({ businessId: session.business._id }),
    session.business.parentOrgId ? ParentOrganization.findById(session.business.parentOrgId) : null,
  ]);

  let groupBranchCount: number | null = null;
  if (parentOrg && session.business.billingAssignment === "group_pays") {
    groupBranchCount = await Business.countDocuments({ parentOrgId: parentOrg._id, billingAssignment: "group_pays" });
  }

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
    groupName: parentOrg?.name ?? null,
    groupBranchCount,
  });
}
