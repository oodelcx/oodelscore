import { NextResponse } from "next/server";
import { connectToDatabase, BillingSubscription, Business, ParentOrganization } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const subscriptions = await BillingSubscription.find().sort({ createdAt: -1 });

  const businessIds = subscriptions.filter((s) => s.ownerType === "business").map((s) => s.ownerId);
  const orgIds = subscriptions.filter((s) => s.ownerType === "parentOrg").map((s) => s.ownerId);
  const [businesses, orgs] = await Promise.all([
    Business.find({ _id: { $in: businessIds } }).select("name"),
    ParentOrganization.find({ _id: { $in: orgIds } }).select("name"),
  ]);
  const nameById = new Map<string, string>([
    ...businesses.map((b) => [b._id.toString(), b.name] as const),
    ...orgs.map((o) => [o._id.toString(), o.name] as const),
  ]);

  const enriched = subscriptions.map((s) => ({
    ...s.toObject(),
    ownerName: nameById.get(s.ownerId.toString()) ?? "Unknown",
  }));

  return NextResponse.json({ status: "ok", subscriptions: enriched });
}
