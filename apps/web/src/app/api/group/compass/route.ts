import { NextResponse } from "next/server";
import { connectToDatabase, getCompassView, getEnabledProducts, hasFeature, computeEvidenceFusion, buildReachCards } from "@oodelscore/shared";
import { getTooltips } from "@/lib/tooltips";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * OodelCX Compass for the parent org itself — see the business route's
 * comment for the full explanation. A branch takes its own assessment
 * (business route), never this one; this is the Group's own top-level
 * assessment of the org's overall approach.
 */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "compass" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "compass")) {
    return NextResponse.json({ status: "error", message: "OodelCX Compass is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const products = getEnabledProducts(session.org);
  const view = await getCompassView("parentOrg", session.org._id, session.org.industry, products);

  const evidenceFusion =
    view.assessmentStatus === "completed" && view.result
      ? await computeEvidenceFusion("parentOrg", session.org._id, view.result.dimensionScores ?? [], products)
      : null;

  const reach =
    view.assessmentStatus === "completed" && view.result
      ? buildReachCards({
          dimensionScores: view.result.dimensionScores ?? [],
          evidence: evidenceFusion ? evidenceFusion.dimensions.map((d) => ({ dimension: d.dimension, status: d.status })) : null,
          portal: "group",
          overrides: await getTooltips("compass-reach"),
        })
      : [];

  return NextResponse.json({ status: "ok", ...view, evidenceFusion, reach });
}
