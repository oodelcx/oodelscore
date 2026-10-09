import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, AlertActivity, ActionBoardItem, Response, computeNetworkSummaries, findNeedsAttention } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

type RouteParams = { params: Promise<{ region: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { region } = await params;
  const regionName = decodeURIComponent(region);

  await connectToDatabase();
  const product = await resolveViewProduct(session.org);
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

  // Weekly average stars for the last 12 weeks: this region against the whole group.
  const trendFrom = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);
  const regionIds = new Set(regionSummaries.map((s) => s.businessId.toString()));
  const weekly = await Response.aggregate<{ _id: { w: Date; b: unknown }; sum: number; n: number }>([
    { $match: { businessId: { $in: allSummaries.map((s) => s.businessId) }, product, submittedAt: { $gte: trendFrom } } },
    { $unwind: "$answers" },
    { $match: { "answers.type": "star_1_5", "answers.value": { $type: "number" } } },
    { $group: { _id: { w: { $dateTrunc: { date: "$submittedAt", unit: "week" } }, b: "$businessId" }, sum: { $sum: "$answers.value" }, n: { $sum: 1 } } },
  ]);
  const weeks = new Map<number, { rs: number; rn: number; gs: number; gn: number }>();
  for (const row of weekly) {
    const key = new Date(row._id.w).getTime();
    const w = weeks.get(key) ?? { rs: 0, rn: 0, gs: 0, gn: 0 };
    w.gs += row.sum;
    w.gn += row.n;
    if (regionIds.has(String(row._id.b))) { w.rs += row.sum; w.rn += row.n; }
    weeks.set(key, w);
  }
  const trend = [...weeks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, w]) => ({
      weekStart: new Date(t).toISOString(),
      region: w.rn >= 3 ? Math.round((w.rs / w.rn) * 100) / 100 : null,
      group: w.gn >= 3 ? Math.round((w.gs / w.gn) * 100) / 100 : null,
    }));
  const openCases = await ActionBoardItem.countDocuments({ businessId: { $in: [...regionIds] }, status: { $ne: "resolved" } });
  const groupWithScores = allSummaries.filter((s) => s.starAverage !== null);
  const groupAverage = groupWithScores.length === 0 ? null : Math.round((groupWithScores.reduce((sum, s) => sum + (s.starAverage as number), 0) / groupWithScores.length) * 100) / 100;
  const responseCount = regionSummaries.reduce((sum, s) => sum + (s.responseCount ?? 0), 0);

  return NextResponse.json({
    status: "ok",
    region: regionName,
    trend,
    openCases,
    groupAverage,
    responseCount,
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
