import { NextResponse } from "next/server";
import { connectToDatabase, Business, User, FeedbackPointRequest } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Businesses can't create their own feedback points — this is the real,
 * in-app view of every request they've raised, scoped the same way the
 * Businesses list itself is (account managers only see their own).
 */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.businesses.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { role, user } = session;
  const businessFilter = role.permissions.businesses.scope === "assigned" ? { accountManagerId: user._id } : {};
  const scopedBusinessIds = await Business.find(businessFilter).distinct("_id");

  const requests = await FeedbackPointRequest.find({ businessId: { $in: scopedBusinessIds } }).sort({ createdAt: -1 });
  const businessById = new Map(
    (await Business.find({ _id: { $in: requests.map((r) => r.businessId) } }).select("name")).map((b) => [
      b._id.toString(),
      b.name,
    ])
  );
  const requesterById = new Map(
    (await User.find({ _id: { $in: requests.map((r) => r.requestedByUserId) } }).select("email")).map((u) => [
      u._id.toString(),
      u.email,
    ])
  );

  return NextResponse.json({
    status: "ok",
    requests: requests.map((r) => ({
      _id: r._id.toString(),
      businessId: r.businessId.toString(),
      businessName: businessById.get(r.businessId.toString()) ?? "Unknown business",
      requesterEmail: requesterById.get(r.requestedByUserId.toString()) ?? "—",
      note: r.note,
      status: r.status,
      createdAt: r.createdAt,
    })),
  });
}
