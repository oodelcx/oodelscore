import { NextResponse } from "next/server";
import {
  connectToDatabase,
  ParentOrganization,
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
 * Admin's read-only "Performance" view for a parent org — combined metrics
 * across every business underneath it, plus a per-business breakdown table
 * (mirrors what Group Overview shows a group owner, computed here for an
 * arbitrary parentOrgId). Backs the Performance tab on /admin/parent-orgs/[id].
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();

  const parentOrg = await ParentOrganization.findById(id);
  if (!parentOrg) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const { role, user } = session;
  const canView = canAccessScopedResource(
    role,
    "parentOrgs",
    "view",
    parentOrg.accountManagerId?.toString() ?? null,
    user._id.toString()
  );
  if (!canView) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const businesses = await Business.find({ parentOrgId: parentOrg._id }).sort({ name: 1 });
  const businessIds = businesses.map((b) => b._id);
  const now = new Date();
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [comparisons, trend, distribution, cxScore, actionItems, perBusiness] = await Promise.all([
    computePeriodComparisons(businessIds, now),
    computeDailyTrend(businessIds, TREND_DAYS, now),
    computeRatingDistribution(businessIds, from30d, now),
    CxPulseScore.findOne({ ownerType: "parentOrg", ownerId: parentOrg._id }).sort({ period: -1 }),
    ActionBoardItem.find({ parentOrgId: parentOrg._id }).select("status dueDate"),
    Promise.all(
      businesses.map(async (b) => {
        const [metrics, ownComparisons] = await Promise.all([
          computeBusinessMetrics(b._id, new Date(0), now),
          computePeriodComparisons([b._id], now),
        ]);
        return {
          businessId: b._id.toString(),
          name: b.name,
          region: b.region,
          starAverage: metrics.starAverage,
          npsScore: metrics.npsScore,
          responseCount: metrics.responseCount,
          weekChangePercent: ownComparisons.week.changePercent,
        };
      })
    ),
  ]);

  const totalResponses = perBusiness.reduce((sum, b) => sum + b.responseCount, 0);
  const starValues = perBusiness.map((b) => b.starAverage).filter((v): v is number => v !== null);
  const npsValues = perBusiness.map((b) => b.npsScore).filter((v): v is number => v !== null);
  const starAverage =
    starValues.length === 0 ? null : Math.round((starValues.reduce((s, v) => s + v, 0) / starValues.length) * 100) / 100;
  const npsScore = npsValues.length === 0 ? null : Math.round(npsValues.reduce((s, v) => s + v, 0) / npsValues.length);

  const openCount = actionItems.filter((i) => i.status !== "resolved").length;
  const overdueCount = actionItems.filter((i) => i.status !== "resolved" && i.dueDate && i.dueDate < now).length;

  return NextResponse.json({
    status: "ok",
    orgName: parentOrg.name,
    totalResponses,
    starAverage,
    npsScore,
    comparisons,
    trend,
    distribution,
    cxPulseLevel: cxScore?.level ?? null,
    actionBoard: { openCount, overdueCount },
    businesses: perBusiness,
  });
}
