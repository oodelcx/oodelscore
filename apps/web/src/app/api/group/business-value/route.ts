import { NextResponse } from "next/server";
import { connectToDatabase, Business, computeBusinessValueImpact, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

const WINDOW_DAYS = 30;

/**
 * Org rollup, edited from here rather than per-branch — same "top account
 * only" reasoning as the survey builder: one place decides, so a branch's
 * own login never edits its own figures (see PATCH below and the business
 * route's PATCH, which rejects a branch outright). A branch that hasn't
 * had its inputs set yet contributes 0 to the totals rather than blocking
 * the whole org's number.
 */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "businessValue" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "businessValue")) {
    return NextResponse.json({ status: "error", message: "Business Value is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const product = await resolveViewProduct(session.org);
  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const businesses = await Business.find({ parentOrgId: session.org._id }).select("name businessValueInputs");

  const branches = await Promise.all(
    businesses.map(async (b) => {
      const impact = await computeBusinessValueImpact(b._id, from, now, b.businessValueInputs, product);
      return { businessId: b._id.toString(), name: b.name, inputs: b.businessValueInputs, impact };
    })
  );

  const configured = branches.filter((b) => b.impact.inputsComplete);
  const totalAtRiskCount = branches.reduce((sum, b) => sum + b.impact.atRiskCount, 0);
  const totalRevenueAtRisk = configured.reduce((sum, b) => sum + (b.impact.revenueAtRisk ?? 0), 0);
  const totalReplacementCost = configured.reduce((sum, b) => sum + (b.impact.replacementCost ?? 0), 0);
  const totalExposure = Math.round((totalRevenueAtRisk + totalReplacementCost) * 100) / 100;

  return NextResponse.json({
    status: "ok",
    product,
    windowDays: WINDOW_DAYS,
    branches,
    branchesConfigured: configured.length,
    branchesTotal: branches.length,
    totals: {
      atRiskCount: totalAtRiskCount,
      revenueAtRisk: Math.round(totalRevenueAtRisk * 100) / 100,
      replacementCost: Math.round(totalReplacementCost * 100) / 100,
      totalExposure,
    },
    canEdit: !session.isTeamMember,
  });
}

/**
 * Editing is the "top account" only — the actual Group owner login, never
 * a team member of any tier (a branch never edits its own figures at all;
 * see the business route's PATCH). Takes businessId to say which branch's
 * figures are being set.
 */
export async function PATCH(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "businessValue" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "businessValue")) {
    return NextResponse.json({ status: "error", message: "Business Value is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember) {
    return NextResponse.json({ status: "error", message: "Only the Group owner can edit these figures" }, { status: 403 });
  }

  await connectToDatabase();
  const body = await request.json().catch(() => null);
  const businessId = typeof body?.businessId === "string" ? body.businessId : "";
  if (!businessId) {
    return NextResponse.json({ status: "error", message: "businessId is required" }, { status: 400 });
  }

  const business = await Business.findOne({ _id: businessId, parentOrgId: session.org._id });
  if (!business) {
    return NextResponse.json({ status: "error", message: "That branch wasn't found under your organization" }, { status: 404 });
  }

  const inputs = business.businessValueInputs;
  if (typeof body?.avgTransactionValue === "number" || body?.avgTransactionValue === null) {
    inputs.avgTransactionValue = body.avgTransactionValue;
  }
  if (typeof body?.visitsPerYear === "number" || body?.visitsPerYear === null) {
    inputs.visitsPerYear = body.visitsPerYear;
  }
  if (typeof body?.acquisitionCost === "number" || body?.acquisitionCost === null) {
    inputs.acquisitionCost = body.acquisitionCost;
  }
  if (typeof body?.atRiskStarThreshold === "number") inputs.atRiskStarThreshold = body.atRiskStarThreshold;
  if (typeof body?.currencySymbol === "string" && body.currencySymbol.trim()) inputs.currencySymbol = body.currencySymbol.trim();

  await business.save();

  return NextResponse.json({ status: "ok", inputs });
}
