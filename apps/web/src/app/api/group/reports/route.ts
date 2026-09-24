import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  ActionBoardItem,
  ImprovementInitiative,
  computeNetworkSummaries,
  groupByRegion,
  computeThemeIntelligence,
  hasFeature,
  hasProduct,
  primaryProductFor,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * The org-wide twin of the business report — per-region rollups plus the
 * same "value delivered" activity counters the Overview headline uses, over
 * a caller-chosen window instead of the fixed 30-day one.
 */
export async function GET(req: Request) {
  const session = await requireParentOrgOwner({ requirePage: "reports" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "reports")) {
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
  const product = primaryProductFor(session.org);

  const businesses = await Business.find({ parentOrgId: session.org._id, active: true }).select("_id");
  const businessIds = businesses.map((b) => b._id);

  const [summaries, themes, casesResolved, initiativesCompleted, customersRespondedTo] = await Promise.all([
    computeNetworkSummaries(session.org._id, from, to, product),
    // Theme intelligence is a CX-only AI feature — meaningless for a
    // Colleague Experience-primary report.
    product === "customer_experience" ? computeThemeIntelligence(businessIds, from, to, from, from) : Promise.resolve([]),
    ActionBoardItem.countDocuments({
      parentOrgId: session.org._id,
      product,
      status: "resolved",
      resolvedAt: { $gte: from, $lte: to },
    }),
    ImprovementInitiative.countDocuments({ parentOrgId: session.org._id, product, status: "completed", completedAt: { $gte: from, $lte: to } }),
    ActionBoardItem.countDocuments({ parentOrgId: session.org._id, product, customerNotifiedAt: { $gte: from, $lte: to } }),
  ]);

  const regions = groupByRegion(summaries, new Set()).sort((a, b) => b.businessCount - a.businessCount);

  // Colleague Experience has no theme-intelligence equivalent yet (CX-only
  // AI feature) — its section is per-branch score summaries + resolved
  // cases only, and only appears as a secondary section when the org has
  // bought BOTH products (a CE-only org already gets CE as its primary
  // section above, not a duplicate here).
  let colleagueExperience: {
    branches: Awaited<ReturnType<typeof computeNetworkSummaries>>;
    casesResolved: number;
  } | null = null;
  if (product === "customer_experience" && hasProduct(session.org, "colleague_experience")) {
    const [ceSummaries, ceCasesResolved] = await Promise.all([
      computeNetworkSummaries(session.org._id, from, to, "colleague_experience"),
      ActionBoardItem.countDocuments({
        parentOrgId: session.org._id,
        product: "colleague_experience",
        status: "resolved",
        resolvedAt: { $gte: from, $lte: to },
      }),
    ]);
    colleagueExperience = { branches: ceSummaries, casesResolved: ceCasesResolved };
  }

  return NextResponse.json({
    status: "ok",
    product,
    orgName: session.org.name,
    period: { from: from.toISOString(), to: to.toISOString() },
    branches: summaries,
    regions,
    themes: themes.slice(0, 10),
    activity: { casesResolved, initiativesCompleted, customersRespondedTo },
    colleagueExperience,
  });
}
