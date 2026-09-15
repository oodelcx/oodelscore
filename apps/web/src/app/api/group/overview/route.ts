import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  AlertActivity,
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
  });
}
