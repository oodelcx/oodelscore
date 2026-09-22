import { NextResponse } from "next/server";
import { connectToDatabase, BillingSubscription, Invoice, BillingCredit, Business } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [subscription, invoices, credits, businesses] = await Promise.all([
    BillingSubscription.findOne({ ownerType: "parentOrg", ownerId: session.org._id }),
    Invoice.find({ ownerType: "parentOrg", ownerId: session.org._id }).sort({ issuedAt: -1 }).limit(12),
    BillingCredit.find({ ownerType: "parentOrg", ownerId: session.org._id }).sort({ issuedAt: -1 }).limit(12),
    Business.find({ parentOrgId: session.org._id }).select("name billingAssignment active"),
  ]);

  const groupPaysBranches = businesses.filter((b) => b.billingAssignment === "group_pays");
  const branchPaysBranches = businesses.filter((b) => b.billingAssignment === "branch_pays");

  // Per-branch billing status (spec Section 5): "group pays" branches don't
  // have their own subscription row — their status follows the org's.
  // "branch pays" branches manage their own, so look those up individually.
  const branchPaysSubs = await BillingSubscription.find({
    ownerType: "business",
    ownerId: { $in: branchPaysBranches.map((b) => b._id) },
  }).select("ownerId status");
  const statusByBusinessId = new Map(branchPaysSubs.map((s) => [s.ownerId.toString(), s.status]));

  const branchRows = businesses.map((b) => ({
    businessId: b._id.toString(),
    name: b.name,
    billingAssignment: b.billingAssignment,
    status:
      b.billingAssignment === "group_pays"
        ? subscription?.status ?? "unknown"
        : b.billingAssignment === "branch_pays"
          ? statusByBusinessId.get(b._id.toString()) ?? "unknown"
          : "unassigned",
  }));

  const overdueSelfBilledCount = branchRows.filter((b) => b.billingAssignment === "branch_pays" && b.status === "overdue").length;

  const hasLiveSubscription = Boolean(subscription && !subscription.isComp && (subscription.stripeSubscriptionId || subscription.paidThroughDate));
  const checkoutLinkAvailable = session.org.checkoutEnabled && !hasLiveSubscription;

  return NextResponse.json({
    status: "ok",
    subscription,
    invoices,
    credits,
    totalBranches: businesses.length,
    groupPaysBranchCount: groupPaysBranches.length,
    branchPaysBranchCount: branchPaysBranches.length,
    overdueSelfBilledCount,
    branches: branchRows,
    checkoutLinkAvailable,
  });
}
