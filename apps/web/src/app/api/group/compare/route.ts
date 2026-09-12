import { NextResponse } from "next/server";
import { connectToDatabase, Business, CxPulseScore, computeBusinessMetrics, computeDailyTrend } from "@oodelscore/shared";
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
      const [metrics, score, trend] = await Promise.all([
        computeBusinessMetrics(b._id, from30d, now),
        CxPulseScore.findOne({ ownerType: "business", ownerId: b._id }).sort({ period: -1 }),
        computeDailyTrend([b._id], TREND_DAYS, now),
      ]);
      return {
        businessId: b._id.toString(),
        name: b.name,
        starAverage: metrics.starAverage,
        npsScore: metrics.npsScore,
        responseCount: metrics.responseCount,
        cxPulseLevel: score?.level ?? null,
        trend,
      };
    })
  );

  return NextResponse.json({ status: "ok", branches });
}
