import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  CxPulseScore,
  computeBusinessMetrics,
  computeDailyTrend,
  computeBusinessCategoryBreakdown,
  primaryProductFor,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

const MAX_COMPARE = 6;
const TREND_DAYS = 56; // ~8 weeks, matches the mockup's default window

export async function GET(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, MAX_COMPARE);
  if (ids.length === 0) return NextResponse.json({ status: "ok", branches: [] });

  await connectToDatabase();
  const businesses = await Business.find({ _id: { $in: ids }, parentOrgId: session.org._id });

  const now = new Date();
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const branches = await Promise.all(
    businesses.map(async (b) => {
      const product = primaryProductFor(b);
      const [metrics, score, trend, categoryBreakdown] = await Promise.all([
        computeBusinessMetrics(b._id, from30d, now, product),
        CxPulseScore.findOne({ ownerType: "business", ownerId: b._id, product }).sort({ period: -1 }),
        computeDailyTrend([b._id], TREND_DAYS, now, product),
        computeBusinessCategoryBreakdown(b._id, from30d, now, product),
      ]);
      return {
        businessId: b._id.toString(),
        name: b.name,
        product,
        starAverage: metrics.starAverage,
        npsScore: metrics.npsScore,
        responseCount: metrics.responseCount,
        cxPulseLevel: score?.level ?? null,
        trend,
        categoryBreakdown,
      };
    })
  );

  // Union of every category name appearing on any selected branch, so the
  // grouped bars and full comparison table have consistent columns even when
  // branches don't share identical category sets.
  const categoryNames = Array.from(new Set(branches.flatMap((b) => b.categoryBreakdown.map((c) => c.name)))).sort();

  return NextResponse.json({ status: "ok", branches, categoryNames });
}
