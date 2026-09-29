import { NextResponse } from "next/server";
import { connectToDatabase, Business, computeBusinessValueImpact, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

const WINDOW_DAYS = 30;

/**
 * Read-only org rollup — each branch enters its own inputs on its own
 * Business Value page (same "each business enters its own values"
 * convention the spec calls for), this just sums what's already there.
 * A branch that hasn't filled its inputs in yet contributes 0 to the
 * totals rather than blocking the whole org's number.
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
      return { businessId: b._id.toString(), name: b.name, impact };
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
  });
}
