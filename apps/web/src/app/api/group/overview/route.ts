import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  AlertActivity,
  ActionBoardItem,
  ImprovementInitiative,
  CxPulseScore,
  computeNetworkSummaries,
  computePeriodComparisons,
  groupByRegion,
  findNeedsAttention,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prevFrom = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [summaries, businesses, orgScore] = await Promise.all([
    computeNetworkSummaries(session.org._id, from, now),
    Business.find({ parentOrgId: session.org._id, active: true }).select("_id"),
    CxPulseScore.findOne({ ownerType: "parentOrg", ownerId: session.org._id }).sort({ period: -1 }),
  ]);
  const comparisons = await computePeriodComparisons(
    businesses.map((b) => b._id),
    now
  );

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

  const withScores = summaries.filter((s) => s.starAverage !== null);
  const withNps = summaries.filter((s) => s.npsScore !== null);
  const networkAverage = withScores.length === 0 ? null : Math.round((withScores.reduce((sum, s) => sum + (s.starAverage as number), 0) / withScores.length) * 100) / 100;
  const networkNps = withNps.length === 0 ? null : Math.round(withNps.reduce((sum, s) => sum + (s.npsScore as number), 0) / withNps.length);

  // "Value delivered this period" — what an exec sees to judge whether the
  // spend is doing anything, not just a snapshot score.
  const [casesResolvedThisPeriod, casesResolvedPrevPeriod, customersRespondedTo, activeInitiatives, completedInitiatives] =
    await Promise.all([
      ActionBoardItem.countDocuments({ parentOrgId: session.org._id, status: "resolved", resolvedAt: { $gte: from } }),
      ActionBoardItem.countDocuments({
        parentOrgId: session.org._id,
        status: "resolved",
        resolvedAt: { $gte: prevFrom, $lt: from },
      }),
      ActionBoardItem.countDocuments({ parentOrgId: session.org._id, customerNotifiedAt: { $gte: from } }),
      ImprovementInitiative.countDocuments({ parentOrgId: session.org._id, status: "in_progress" }),
      ImprovementInitiative.countDocuments({ parentOrgId: session.org._id, status: "completed", completedAt: { $gte: from } }),
    ]);

  // "Needs a decision from you" — cases that have escalated all the way to
  // this org's top configured level and are still unresolved. Only
  // meaningful once escalation goes beyond level 1 (the branch's own owner).
  const topLevel = session.org.escalationLevels.length
    ? Math.max(...session.org.escalationLevels.map((l) => l.level))
    : 1;
  const needsYourDecision =
    topLevel > 1
      ? await ActionBoardItem.find({
          parentOrgId: session.org._id,
          status: { $ne: "resolved" },
          currentEscalationLevel: topLevel,
        })
          .select("title businessId currentEscalationLevel")
          .limit(10)
      : [];

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

  return NextResponse.json({
    status: "ok",
    branchCount: businesses.length,
    networkAverage,
    networkNps,
    cxPulseLevel: orgScore?.level ?? null,
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
