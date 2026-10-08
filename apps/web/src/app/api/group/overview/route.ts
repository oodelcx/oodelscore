import { NextResponse } from "next/server";
import {
  sensitiveVisibilityClause,
  maskPeriodComparisonsForAnonymity,
  connectToDatabase,
  Business,
  AlertActivity,
  ActionBoardItem,
  describeEscalation,
  ImprovementInitiative,
  CxPulseScore,
  computeNetworkSummaries,
  computePeriodComparisons,
  groupByRegion,
  findNeedsAttention,
} from "@oodelscore/shared";
import { requireParentOrgOwner, caseViewerForGroup } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";
import { getColleagueWording } from "@/lib/wording";

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const product = await resolveViewProduct(session.org);
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prevFrom = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [summaries, businesses, orgScore] = await Promise.all([
    computeNetworkSummaries(session.org._id, from, now, product),
    Business.find({ parentOrgId: session.org._id, active: true }).select("_id"),
    CxPulseScore.findOne({ ownerType: "parentOrg", ownerId: session.org._id, product }).sort({ period: -1 }).lean(),
  ]);
  const rawComparisons = await computePeriodComparisons(
    businesses.map((b) => b._id),
    now,
    product
  );

  // Colleague anonymity floor: a window with fewer responses than the floor keeps its count but loses its scores.
  const comparisons = product === "colleague_experience" ? maskPeriodComparisonsForAnonymity(rawComparisons) : rawComparisons;

  const flaggedActivity = await AlertActivity.find({
    businessId: { $in: businesses.map((b) => b._id) },
    triggeredAt: { $gte: from },
  }).select("businessId");
  const flaggedBusinessIds = new Set(flaggedActivity.map((a) => a.businessId.toString()));

  const regions = groupByRegion(summaries, flaggedBusinessIds).sort((a, b) => b.businessCount - a.businessCount);
  const needsAttention = findNeedsAttention(summaries).slice(0, 5);
  const topPerformers = summaries
    .filter((s) => s.starAverage !== null)
    .sort((a, b) => (b.starAverage as number) - (a.starAverage as number))
    .slice(0, 5);

  const withScores = summaries.filter((s) => s.rawStarAverage !== null);
  const withNps = summaries.filter((s) => s.rawNpsScore !== null);
  const networkAverage = withScores.length === 0 ? null : Math.round((withScores.reduce((sum, s) => sum + (s.rawStarAverage as number), 0) / withScores.length) * 100) / 100;
  const networkNps = withNps.length === 0 ? null : Math.round(withNps.reduce((sum, s) => sum + (s.rawNpsScore as number), 0) / withNps.length);

  // Weighted by each branch's own response count, same reasoning as
  // Command Center's org-wide roll-up.
  const csatBranches = summaries.filter((s) => s.csatPercent !== null);
  const networkCsatSampleSize = csatBranches.reduce((sum, s) => sum + s.responseCount, 0);
  const networkCsat =
    csatBranches.length === 0 ? null : Math.round((csatBranches.reduce((sum, s) => sum + (s.csatPercent as number) * s.responseCount, 0) / networkCsatSampleSize) * 10) / 10;
  const cesBranches = summaries.filter((s) => s.cesLowEffortPercent !== null);
  const networkCesSampleSize = cesBranches.reduce((sum, s) => sum + s.responseCount, 0);
  const networkCesLowEffort =
    cesBranches.length === 0 ? null : Math.round((cesBranches.reduce((sum, s) => sum + (s.cesLowEffortPercent as number) * s.responseCount, 0) / networkCesSampleSize) * 10) / 10;

  // "Value delivered this period" — what an exec sees to judge whether the
  // spend is doing anything, not just a snapshot score.
  const [casesResolvedThisPeriod, casesResolvedPrevPeriod, customersRespondedTo, activeInitiatives, completedInitiatives] =
    await Promise.all([
      ActionBoardItem.countDocuments({ parentOrgId: session.org._id, product, status: "resolved", resolvedAt: { $gte: from } }),
      ActionBoardItem.countDocuments({
        parentOrgId: session.org._id,
        product,
        status: "resolved",
        resolvedAt: { $gte: prevFrom, $lt: from },
      }),
      ActionBoardItem.countDocuments({ parentOrgId: session.org._id, product, customerNotifiedAt: { $gte: from } }),
      ImprovementInitiative.countDocuments({ parentOrgId: session.org._id, product, status: "in_progress" }),
      ImprovementInitiative.countDocuments({ parentOrgId: session.org._id, product, status: "completed", completedAt: { $gte: from } }),
    ]);

  // "Needs a decision from you": unresolved cases that have escalated all the
  // way to the top of their own branch's chain. Chains differ per branch (a
  // branch under a cluster has a longer one), so each case is checked
  // against its own branch's top step.
  const escalatedCases = await ActionBoardItem.find({
    parentOrgId: session.org._id,
    product,
    status: { $ne: "resolved" },
    currentEscalationLevel: { $gt: 1 },
    $and: [sensitiveVisibilityClause(caseViewerForGroup(session))],
  })
    .select("title businessId currentEscalationLevel")
    .sort({ levelEnteredAt: -1 })
    .limit(200);
  const topByBusiness = new Map<string, number | null>();
  const needsYourDecision: typeof escalatedCases = [];
  for (const c of escalatedCases) {
    const key = c.businessId.toString();
    if (!topByBusiness.has(key)) {
      const info = await describeEscalation(key, 1);
      topByBusiness.set(key, info.topLevel);
    }
    const top = topByBusiness.get(key);
    if (top !== null && top !== undefined && c.currentEscalationLevel >= top) needsYourDecision.push(c);
    if (needsYourDecision.length >= 10) break;
  }

  const monthChange = comparisons.month.changePercent;
  const headline =
    networkAverage === null
      ? null
      : monthChange === null
        ? `Network average is ${networkAverage}/5 — not enough prior-period data yet to show a trend.`
        : monthChange > 0
          ? `Network average is up ${monthChange}% this month, now ${networkAverage}/5 across ${businesses.length} branches.`
          : monthChange < 0
            ? `Network average is down ${Math.abs(monthChange)}% this month, now ${networkAverage}/5 — see Needs Attention below for where.`
            : `Network average is holding steady at ${networkAverage}/5 this month.`;

  const decisionBusinessIds = needsYourDecision.map((i) => i.businessId);
  const decisionBusinesses = decisionBusinessIds.length
    ? await Business.find({ _id: { $in: decisionBusinessIds } }).select("name")
    : [];
  const nameByBusinessId = new Map(decisionBusinesses.map((b) => [b._id.toString(), b.name]));

  // CX Pulse as a widget, not a full section, for most Overview visitors:
  // just the score plus the 2-3 dimensions dragging it down most, so a
  // glance at Overview answers "what's holding us back" without a trip to
  // the full 5-dimension maturity drill-down (still available at /maturity).
  const cxPulseHoldingBack = orgScore
    ? (Object.entries(orgScore.dimensions) as [keyof typeof orgScore.dimensions, number][])
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([dimension, value]) => ({ dimension, value }))
    : [];

  return NextResponse.json({
    status: "ok",
    product,
    wording: product === "colleague_experience" ? await getColleagueWording() : null,
    branchCount: businesses.length,
    networkAverage,
    networkNps,
    networkCsat,
    networkCsatSampleSize,
    networkCesLowEffort,
    networkCesSampleSize,
    cxPulseLevel: orgScore?.level ?? null,
    cxPulseHoldingBack,
    comparisons,
    regions,
    needsAttention,
    topPerformers,
    headline,
    valueDelivered: {
      casesResolvedThisPeriod,
      casesResolvedPrevPeriod,
      customersRespondedTo,
      activeInitiatives,
      completedInitiatives,
    },
    needsYourDecision: needsYourDecision.map((i) => ({
      _id: i._id.toString(),
      title: i.title,
      businessName: nameByBusinessId.get(i.businessId.toString()) ?? "—",
    })),
  });
}
