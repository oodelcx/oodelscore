import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint, Business } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ fpId: string }> };

/** Group twin of the business route's expiry endpoint — see its comment. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { fpId } = await params;
  await connectToDatabase();
  const feedbackPoint = await FeedbackPoint.findById(fpId);
  if (!feedbackPoint) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  const branch = await Business.findOne({ _id: feedbackPoint.businessId, parentOrgId: session.org._id }).select("_id");
  if (!branch) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  // Publish / close / reopen are one click, with no date to fiddle with.
  if (body?.action === "publish") {
    feedbackPoint.isDraft = false;
    feedbackPoint.active = true;
    await feedbackPoint.save();
    return NextResponse.json({ status: "ok", feedbackPoint });
  }
  if (body?.action === "close") {
    feedbackPoint.active = false;
    await feedbackPoint.save();
    return NextResponse.json({ status: "ok", feedbackPoint });
  }
  if (body?.action === "reopen") {
    feedbackPoint.active = true;
    // A date that has already passed would shut it again at once, so clear it when reopening.
    if (feedbackPoint.endsAt && feedbackPoint.endsAt < new Date()) feedbackPoint.endsAt = null;
    await feedbackPoint.save();
    return NextResponse.json({ status: "ok", feedbackPoint });
  }
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
