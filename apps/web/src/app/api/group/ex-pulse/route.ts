import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  CxPulseScore,
  hasProduct,
  getTeamMemberProducts,
  computePeriodComparisons,
  computeDailyENPSTrend,
  computeColleagueDemographicBreakdown,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Colleague Experience's org-level rollup — same mechanic as
 * business/ex-pulse, one level up: the org's own EX Pulse score/history
 * (computed nightly the same way as every business's), a per-branch
 * breakdown table (mirrors group/maturity's `branches`), and org-wide
 * benchmarking/demographics computed live across every branch's colleague
 * responses.
 */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "exPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.org, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember && !getTeamMemberProducts(session.user).includes("colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const score = await CxPulseScore.findOne({ ownerType: "parentOrg", ownerId: session.org._id, product: "colleague_experience" }).sort({
    period: -1,
  });
  const history = await CxPulseScore.find({ ownerType: "parentOrg", ownerId: session.org._id, product: "colleague_experience" })
    .sort({ period: -1 })
    .limit(6);

  const businesses = await Business.find({ parentOrgId: session.org._id, active: true }).select("name region enabledProducts").sort({ name: 1 });
  const ceBusinesses = businesses.filter((b) => hasProduct(b, "colleague_experience"));
  const businessScores = await Promise.all(
    ceBusinesses.map((b) => CxPulseScore.findOne({ ownerType: "business", ownerId: b._id, product: "colleague_experience" }).sort({ period: -1 }))
  );
  const branches = ceBusinesses.map((b, i) => ({
    businessId: b._id.toString(),
    name: b.name,
    region: b.region ?? null,
    compositeScore: businessScores[i]?.compositeScore ?? null,
    level: businessScores[i]?.level ?? null,
    enps: businessScores[i]?.enps ?? null,
  }));

  const now = new Date();
  const windowFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const ceBusinessIds = ceBusinesses.map((b) => b._id);
  const [periodComparisons, dailyTrend, demographics] = await Promise.all([
    computePeriodComparisons(ceBusinessIds, now, "colleague_experience"),
    computeDailyENPSTrend(ceBusinessIds, 30, now),
    computeColleagueDemographicBreakdown(ceBusinessIds, windowFrom, now),
  ]);

  return NextResponse.json({ status: "ok", score, history, branches, periodComparisons, dailyTrend, demographics });
}
