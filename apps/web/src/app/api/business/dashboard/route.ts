import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Response,
  FeedbackPoint,
  Business,
  ParentOrganization,
  DecisionLogEntry,
  CxPulseScore,
  computeBusinessMetrics,
  computePeriodComparisons,
  computeDailyTrend,
  computeRatingDistribution,
  primaryProductFor,
} from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

const TREND_DAYS = 14;

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const product = primaryProductFor(session.business);
  const businessIds = [session.business._id];
  const now = new Date();
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [overall, comparisons, trend, distribution, feedbackPoints, recentWithComments, ownCxPulseScore] = await Promise.all([
    computeBusinessMetrics(session.business._id, new Date(0), now, product),
    computePeriodComparisons(businessIds, now, product),
    computeDailyTrend(businessIds, TREND_DAYS, now, product),
    computeRatingDistribution(businessIds, from30d, now, product),
    FeedbackPoint.find({ businessId: session.business._id }),
    Response.find({ businessId: session.business._id, product }).sort({ submittedAt: -1 }).limit(20),
    CxPulseScore.findOne({ ownerType: "business", ownerId: session.business._id, product }).sort({ period: -1 }).lean(),
  ]);

  // CX Pulse as an Overview widget, not a full section: the score plus the
  // 2-3 dimensions dragging it down most. The full 5-dimension drill-down
  // stays at /business/cx-pulse for whoever wants it.
  const cxPulseHoldingBack = ownCxPulseScore
    ? (Object.entries(ownCxPulseScore.dimensions) as [keyof typeof ownCxPulseScore.dimensions, number][])
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([dimension, value]) => ({ dimension, value }))
    : [];

  const totalScans = feedbackPoints.reduce((sum, fp) => sum + fp.scans, 0);
  const conversionRate = totalScans === 0 ? null : Math.round((overall.responseCount / totalScans) * 1000) / 10;

  const latestComments = recentWithComments
    .map((r) => {
      const comment = r.answers.find((a) => a.type === "open_text" && typeof a.value === "string" && a.value.trim());
      const star = r.answers.find((a) => a.type === "star_1_5" && typeof a.value === "number");
      if (!comment) return null;
      return {
        comment: comment.value as string,
        star: (star?.value as number) ?? null,
        submittedAt: r.submittedAt,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .slice(0, 3);

  let branch: {
    parentOrgName: string;
    region: string;
    cxPulseLevel: number | null;
    regionAverageStarScore: number | null;
    regionRank: number | null;
    regionBusinessCount: number;
    recentDecisions: { title: string; description: string; loggedAt: string }[];
  } | null = null;

  if (session.business.parentOrgId) {
    const parentOrg = await ParentOrganization.findById(session.business.parentOrgId);
    const siblingBusinesses = await Business.find({
      parentOrgId: session.business.parentOrgId,
      region: session.business.region,
    }).select("_id");
    const siblingIds = siblingBusinesses.map((b) => b._id);

    const [siblingMetrics, decisions] = await Promise.all([
      Promise.all(siblingIds.map((id) => computeBusinessMetrics(id, new Date(0), now, product))),
      DecisionLogEntry.find({ affectedBusinessIds: session.business._id, product }).sort({ createdAt: -1 }).limit(3),
    ]);

    const regionAverages = siblingMetrics.map((m) => m.starAverage).filter((v): v is number => v !== null);
    const regionAverageStarScore =
      regionAverages.length === 0 ? null : Math.round((regionAverages.reduce((s, v) => s + v, 0) / regionAverages.length) * 100) / 100;

    const sortedByScore = siblingIds
      .map((id, i) => ({ id: id.toString(), starAverage: siblingMetrics[i].starAverage }))
      .filter((s) => s.starAverage !== null)
      .sort((a, b) => (b.starAverage as number) - (a.starAverage as number));
    const regionRank = sortedByScore.findIndex((s) => s.id === session.business._id.toString()) + 1;

    branch = {
      parentOrgName: parentOrg?.name ?? "",
      region: session.business.region,
      cxPulseLevel: ownCxPulseScore?.level ?? null,
      regionAverageStarScore,
      regionRank: regionRank > 0 ? regionRank : null,
      regionBusinessCount: siblingIds.length,
      recentDecisions: decisions.map((d) => ({ title: d.title, description: d.trigger, loggedAt: d.createdAt.toISOString() })),
    };
  }

  return NextResponse.json({
    status: "ok",
    product,
    totalResponses: overall.responseCount,
    starAverage: overall.starAverage,
    npsScore: overall.npsScore,
    conversionRate,
    totalScans,
    comparisons,
    trend,
    distribution,
    latestComments,
    branch,
    cxPulseLevel: ownCxPulseScore?.level ?? null,
    cxPulseHoldingBack,
  });
}
