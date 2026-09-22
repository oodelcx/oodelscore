import { NextResponse } from "next/server";
import {
  connectToDatabase,
  ActionBoardItem,
  ImprovementInitiative,
  computeBusinessMetrics,
  computeBusinessCategoryBreakdown,
  computeThemeIntelligence,
} from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * One period's worth of report data for a single business — the numbers a
 * branch owner would want to print or hand to a district manager. Reuses
 * the same aggregation helpers the live dashboards already use, so a
 * report always matches what the dashboard shows for the same window.
 */
export async function GET(req: Request) {
  const session = await requireBusinessOwner();
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

  const [metrics, categoryBreakdown, themes, casesResolved, initiativesCompleted, customersRespondedTo] = await Promise.all([
    computeBusinessMetrics(session.business._id, from, to),
    computeBusinessCategoryBreakdown(session.business._id, from, to),
    computeThemeIntelligence([session.business._id], from, to, from, from),
    ActionBoardItem.countDocuments({ businessId: session.business._id, status: "resolved", resolvedAt: { $gte: from, $lte: to } }),
    ImprovementInitiative.countDocuments({
      $or: [{ businessId: session.business._id }, { affectedBusinessIds: session.business._id }],
      status: "completed",
      completedAt: { $gte: from, $lte: to },
    }),
    ActionBoardItem.countDocuments({ businessId: session.business._id, customerNotifiedAt: { $gte: from, $lte: to } }),
  ]);

  return NextResponse.json({
    status: "ok",
    businessName: session.business.name,
    period: { from: from.toISOString(), to: to.toISOString() },
    metrics,
    categoryBreakdown,
    themes: themes.slice(0, 10),
    activity: { casesResolved, initiativesCompleted, customersRespondedTo },
  });
}
