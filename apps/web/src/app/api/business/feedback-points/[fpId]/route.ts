import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ fpId: string }> };

/**
 * Self-service expiry control — the one field of a feedback point a
 * standalone business can edit itself, independent of the survey-building
 * split (see this folder's root route comment): a QR/link's "how long is
 * this open" is operational, not survey content, so it doesn't need to go
 * through Admin. `endsAt: null` means ongoing forever (the FeedbackPoint
 * model's own default); the business can set a date to put an end on an
 * open-ended link, or clear it back to null to make a dated one ongoing
 * again. A branch's points stay centrally managed — see the group route's
 * twin of this endpoint.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "This feedback point is managed centrally by your parent organization." },
      { status: 403 }
    );
  }

  const { fpId } = await params;
  await connectToDatabase();
  const feedbackPoint = await FeedbackPoint.findOne({ _id: fpId, businessId: session.business._id });
  if (!feedbackPoint) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (body?.endsAt === null) {
    feedbackPoint.endsAt = null;
  } else if (typeof body?.endsAt === "string") {
    const date = new Date(body.endsAt);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ status: "error", message: "Invalid date" }, { status: 400 });
    }
    feedbackPoint.endsAt = date;
  } else {
    return NextResponse.json({ status: "error", message: "endsAt (a date string, or null to clear it) is required" }, { status: 400 });
  }

  await feedbackPoint.save();
  return NextResponse.json({ status: "ok", feedbackPoint });
}
