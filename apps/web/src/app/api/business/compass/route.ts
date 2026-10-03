import { NextResponse } from "next/server";
import { connectToDatabase, getCompassView, getEnabledProducts, hasFeature, computeEvidenceFusion } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * OodelCX Compass (PRODUCT-ROADMAP.md Phase 7) — a business/branch's own
 * assessment, fully independent of its parent org's (same "every account
 * gets its own" convention already established for CX Goals). Returns the
 * question set (with industry-specific wording already rendered) plus
 * whichever answers/results already exist.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "compass" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "compass")) {
    return NextResponse.json({ status: "error", message: "OodelCX Compass is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const products = getEnabledProducts(session.business);
  const view = await getCompassView("business", session.business._id, session.business.industry, products);

  const evidenceFusion =
    view.assessmentStatus === "completed" && view.result
      ? await computeEvidenceFusion("business", session.business._id, view.result.dimensionScores ?? [], products)
      : null;

  return NextResponse.json({ status: "ok", ...view, evidenceFusion });
}
