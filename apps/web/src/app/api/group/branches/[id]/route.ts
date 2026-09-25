import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  ActionBoardItem,
  CxPulseScore,
  FeedbackPoint,
  computeBusinessMetrics,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Read-only: literally the same numbers the branch manager sees on their own
 * dashboard, per the mockup ("Same dashboard the branch manager sees").
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const business = await Business.findOne({ _id: id, parentOrgId: session.org._id });
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const product = await resolveViewProduct(business);
  const now = new Date();
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [metrics, openItems, score, feedbackPoints] = await Promise.all([
    computeBusinessMetrics(business._id, from30d, now, product),
    ActionBoardItem.find({ businessId: business._id, product, status: { $ne: "resolved" } }).sort({ dueDate: 1 }).limit(10),
    CxPulseScore.findOne({ ownerType: "business", ownerId: business._id, product }).sort({ period: -1 }),
    // A Parent-Org owner has no other way to reach a branch's own QR link —
    // this dashboard is otherwise read-only ("Same dashboard the branch
    // manager sees"), but retrieving the scan link is a legitimate oversight
    // need (e.g. reprinting a lost poster) that shouldn't require asking the
    // branch to look it up and send it over.
    FeedbackPoint.find({ businessId: business._id, product, active: true }).select("name qrToken").sort({ name: 1 }),
  ]);

  return NextResponse.json({
    status: "ok",
    product,
    business: { name: business.name, region: business.region, billingAssignment: business.billingAssignment },
    metrics,
    openActionItems: openItems.map((item) => ({
      _id: item._id.toString(),
      title: item.title,
      status: item.status,
      overdue: item.dueDate !== null && item.dueDate < now && item.status !== "resolved",
    })),
    cxPulse: score ? { level: score.level, compositeScore: score.compositeScore } : null,
    feedbackPoints: feedbackPoints.map((fp) => ({ _id: fp._id.toString(), name: fp.name, qrToken: fp.qrToken })),
  });
}
