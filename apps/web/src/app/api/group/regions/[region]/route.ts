import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, AlertActivity, computeNetworkSummaries, findNeedsAttention, primaryProductFor } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ region: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { region } = await params;
  const regionName = decodeURIComponent(region);

  await connectToDatabase();
  const product = primaryProductFor(session.org);
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const allSummaries = await computeNetworkSummaries(session.org._id, from, now, product);
  const regionSummaries = allSummaries.filter((s) => (s.region || "Unassigned") === regionName);

  const withScores = regionSummaries.filter((s) => s.starAverage !== null);
  const withNps = regionSummaries.filter((s) => s.npsScore !== null);
  const average = withScores.length === 0 ? null : Math.round((withScores.reduce((sum, s) => sum + (s.starAverage as number), 0) / withScores.length) * 100) / 100;
  const nps = withNps.length === 0 ? null : Math.round(withNps.reduce((sum, s) => sum + (s.npsScore as number), 0) / withNps.length);

  const outliers = findNeedsAttention(allSummaries).filter((o) => o.region === regionName || (!o.region && regionName === "Unassigned"));

  const regionalRules = await AlertRule.find({ scope: "parentOrg_region", ownerId: session.org._id, region: regionName });
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const suddenDropActivity = await AlertActivity.find({
    businessId: { $in: regionSummaries.map((s) => s.businessId) },
    triggeredAt: { $gte: sixtyDaysAgo },
  }).sort({ triggeredAt: -1 });

  return NextResponse.json({
    status: "ok",
    region: regionName,
    businessCount: regionSummaries.length,
    average,
    nps,
    outliers,
    branches: regionSummaries.sort((a, b) => (b.starAverage ?? -1) - (a.starAverage ?? -1)),
    regionalRuleCount: regionalRules.length,
    recentActivity: suddenDropActivity.slice(0, 10).map((a) => ({
      businessId: a.businessId.toString(),
      triggeredAt: a.triggeredAt,
      snapshotValue: a.snapshotValue,
    })),
  });
}
