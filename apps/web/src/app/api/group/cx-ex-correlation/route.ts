import { NextResponse } from "next/server";
import { connectToDatabase, Business, hasProduct, computeCxExCorrelationRows } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Top-account-level only — see business/cx-ex-correlation/route.ts for the
 * standalone equivalent. Group is the natural home for a multi-branch
 * account: only the org owner (or a team member the org explicitly grants
 * the cxExCorrelation page to) sees this, never a per-branch manager, since
 * the whole point is spotting a branch failing on both signals from above.
 */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "cxExCorrelation" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!(hasProduct(session.org, "customer_experience") && hasProduct(session.org, "colleague_experience"))) {
    return NextResponse.json(
      { status: "error", message: "Requires both Customer Experience and Colleague Experience" },
      { status: 403 }
    );
  }

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id, active: true }).select("_id");
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rows = await computeCxExCorrelationRows(
    businesses.map((b) => b._id),
    from,
    now
  );

  return NextResponse.json({ status: "ok", rows });
}
