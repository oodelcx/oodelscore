import { NextResponse } from "next/server";
import { connectToDatabase, Response, FeedbackPoint } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [responses, feedbackPoints] = await Promise.all([
    Response.find({ businessId: session.business._id }).sort({ submittedAt: -1 }).limit(200),
    FeedbackPoint.find({ businessId: session.business._id }).select("_id name"),
  ]);

  const feedbackPointNameById = new Map(feedbackPoints.map((fp) => [fp._id.toString(), fp.name]));
  const enriched = responses.map((r) => ({
    ...r.toObject(),
    feedbackPointName: feedbackPointNameById.get(r.feedbackPointId.toString()) ?? "Unknown",
  }));

  return NextResponse.json({ status: "ok", responses: enriched });
}
