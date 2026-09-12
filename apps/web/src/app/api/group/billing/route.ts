import { NextResponse } from "next/server";
import { connectToDatabase, BillingSubscription, Invoice, Business } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [subscription, invoices, groupPaysBranchCount] = await Promise.all([
    BillingSubscription.findOne({ ownerType: "parentOrg", ownerId: session.org._id }),
    Invoice.find({ ownerType: "parentOrg", ownerId: session.org._id }).sort({ issuedAt: -1 }).limit(12),
    Business.countDocuments({ parentOrgId: session.org._id, billingAssignment: "group_pays" }),
  ]);

  return NextResponse.json({ status: "ok", subscription, invoices, groupPaysBranchCount });
}
