import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  ActionBoardItem,
  CxPulseScore,
  computeBusinessMetrics,
  computePeriodComparisons,
  computeDailyTrend,
  computeRatingDistribution,
  canAccessScopedResource,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const TREND_DAYS = 14;

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Admin's read-only "Performance" view for a single business — the numbers
 * the business itself sees on its own dashboard (`/api/business/dashboard`),
 * computed for an arbitrary businessId rather than the caller's own. Backs
 * the Performance tab on /admin/businesses/[id].
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();

  const business = await Business.findById(id);
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const { role, user } = session;
  const canView = canAccessScopedResource(
    role,
    "businesses",
    "view",
    business.accountManagerId?.toString() ?? null,
    user._id.toString()
  );
  if (!canView) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const businessIds = [business._id];
  const now = new Date();
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [overall, comparisons, trend, distribution, cxScore, actionItems] = await Promise.all([
    computeBusinessMetrics(business._id, new Date(0), now),
    computePeriodComparisons(businessIds, now),
    computeDailyTrend(businessIds, TREND_DAYS, now),
    computeRatingDistribution(businessIds, from30d, now),
    CxPulseScore.findOne({ ownerType: "business", ownerId: business._id, product: "customer_experience" }).sort({ period: -1 }),
    ActionBoardItem.find({ businessId: business._id }).select("status dueDate"),
  ]);

  const openCount = actionItems.filter((i) => i.status !== "resolved").length;
  const overdueCount = actionItems.filter((i) => i.status !== "resolved" && i.dueDate && i.dueDate < now).length;

  return NextResponse.json({
    status: "ok",
    businessName: business.name,
    totalResponses: overall.responseCount,
    starAverage: overall.starAverage,
    npsScore: overall.npsScore,
    comparisons,
    trend,
    distribution,
    cxPulseLevel: cxScore?.level ?? null,
    actionBoard: { openCount, overdueCount },
  });
}
