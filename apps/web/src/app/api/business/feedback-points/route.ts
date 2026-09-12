import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * View-only for the Business portal (per the mockup): a business sees its
 * feedback points and can request new ones or changes, but creation is an
 * Admin/account-manager action (see /api/admin/businesses/[id]/feedback-points)
 * so every survey stays correctly configured.
 */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const points = await FeedbackPoint.find({ businessId: session.business._id }).sort({ createdAt: 1 });
  return NextResponse.json({ status: "ok", feedbackPoints: points });
}
