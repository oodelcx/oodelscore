import { NextResponse } from "next/server";
import {
  connectToDatabase,
  ActionBoardItem,
  ImprovementInitiative,
  computeBusinessMetrics,
  computeBusinessCategoryBreakdown,
  computeThemeIntelligence,
  hasFeature,
  hasProduct,
} from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * One period's worth of report data for a single business — the numbers a
 * branch owner would want to print or hand to a district manager. Reuses
 * the same aggregation helpers the live dashboards already use, so a
 * report always matches what the dashboard shows for the same window.
 */
export async function GET(req: Request) {
  const session = await requireBusinessOwner({ requirePage: "reports" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "reports")) {
    return NextResponse.json({ status: "error", message: "Reports is not enabled for this account" }, { status: 403 });
  }

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
    ActionBoardItem.countDocuments({
      businessId: session.business._id,
      product: "customer_experience",
      status: "resolved",
      resolvedAt: { $gte: from, $lte: to },
    }),
    ImprovementInitiative.countDocuments({
      $or: [{ businessId: session.business._id }, { affectedBusinessIds: session.business._id }],
      status: "completed",
      completedAt: { $gte: from, $lte: to },
    }),
    ActionBoardItem.countDocuments({ businessId: session.business._id, customerNotifiedAt: { $gte: from, $lte: to } }),
  ]);

  // Colleague Experience has no theme-intelligence equivalent yet (that's a
  // CX-only AI feature) — its report section is scores + categories +
  // resolved cases only, and only appears when the business has bought it.
  let colleagueExperience: {
    metrics: Awaited<ReturnType<typeof computeBusinessMetrics>>;
    categoryBreakdown: Awaited<ReturnType<typeof computeBusinessCategoryBreakdown>>;
    casesResolved: number;
  } | null = null;
  if (hasProduct(session.business, "colleague_experience")) {
    const [ceMetrics, ceCategoryBreakdown, ceCasesResolved] = await Promise.all([
      computeBusinessMetrics(session.business._id, from, to, "colleague_experience"),
      computeBusinessCategoryBreakdown(session.business._id, from, to, "colleague_experience"),
      ActionBoardItem.countDocuments({
        businessId: session.business._id,
        product: "colleague_experience",
        status: "resolved",
        resolvedAt: { $gte: from, $lte: to },
      }),
    ]);
    colleagueExperience = { metrics: ceMetrics, categoryBreakdown: ceCategoryBreakdown, casesResolved: ceCasesResolved };
  }

  return NextResponse.json({
    status: "ok",
    businessName: session.business.name,
    period: { from: from.toISOString(), to: to.toISOString() },
    metrics,
    categoryBreakdown,
    themes: themes.slice(0, 10),
    activity: { casesResolved, initiativesCompleted, customersRespondedTo },
    colleagueExperience,
  });
}
