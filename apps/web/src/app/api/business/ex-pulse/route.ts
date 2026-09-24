import { NextResponse } from "next/server";
import {
  connectToDatabase,
  CxPulseScore,
  hasProduct,
  getTeamMemberProducts,
  computePeriodComparisons,
  computeDailyENPSTrend,
} from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Colleague Experience's own maturity-ladder score (same mechanic as CX
 * Pulse, computed by the same nightly job — see cxpulse/compute.ts) plus
 * eNPS, the product's standing headline metric, plus own-history
 * benchmarking (week/month/quarter/year eNPS point change and a 30-day
 * trend). Read-only: the pulse score is never computed live here, but the
 * benchmarking figures are (same live-computation the CX dashboard already
 * does for its own period comparisons).
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "exPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.business, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember && !getTeamMemberProducts(session.user).includes("colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const score = await CxPulseScore.findOne({
    ownerType: "business",
    ownerId: session.business._id,
    product: "colleague_experience",
  }).sort({ period: -1 });
  const history = await CxPulseScore.find({ ownerType: "business", ownerId: session.business._id, product: "colleague_experience" })
    .sort({ period: -1 })
    .limit(6);

  const now = new Date();
  const [periodComparisons, dailyTrend] = await Promise.all([
    computePeriodComparisons([session.business._id], now, "colleague_experience"),
    computeDailyENPSTrend([session.business._id], 30, now),
  ]);

  return NextResponse.json({ status: "ok", score, history, periodComparisons, dailyTrend });
}
