import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  ActionBoardItem,
  ImprovementInitiative,
  computeNetworkSummaries,
  groupByRegion,
  computeThemeIntelligence,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * The org-wide twin of the business report — per-region rollups plus the
 * same "value delivered" activity counters the Overview headline uses, over
 * a caller-chosen window instead of the fixed 30-day one.
 */
export async function GET(req: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ status: "error", message: "Invalid date range" }, { status: 400 });
  }

  await connectToDatabase();

  const businesses = await Business.find({ parentOrgId: session.org._id, active: true }).select("_id");
  const businessIds = businesses.map((b) => b._id);

  const [summaries, themes, casesResolved, initiativesCompleted, customersRespondedTo] = await Promise.all([
    computeNetworkSummaries(session.org._id, from, to),
    computeThemeIntelligence(businessIds, from, to, from, from),
    ActionBoardItem.countDocuments({ parentOrgId: session.org._id, status: "resolved", resolvedAt: { $gte: from, $lte: to } }),
    ImprovementInitiative.countDocuments({ parentOrgId: session.org._id, status: "completed", completedAt: { $gte: from, $lte: to } }),
    ActionBoardItem.countDocuments({ parentOrgId: session.org._id, customerNotifiedAt: { $gte: from, $lte: to } }),
  ]);

  const regions = groupByRegion(summaries, new Set()).sort((a, b) => b.businessCount - a.businessCount);

  return NextResponse.json({
    status: "ok",
    orgName: session.org.name,
    period: { from: from.toISOString(), to: to.toISOString() },
    branches: summaries,
    regions,
    themes: themes.slice(0, 10),
    activity: { casesResolved, initiativesCompleted, customersRespondedTo },
  });
}
