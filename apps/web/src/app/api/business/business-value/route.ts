import { NextResponse } from "next/server";
import { connectToDatabase, computeBusinessValueImpact, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

const WINDOW_DAYS = 30;

export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "businessValue" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "businessValue")) {
    return NextResponse.json({ status: "error", message: "Business Value is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const product = await resolveViewProduct(session.business);
  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const impact = await computeBusinessValueImpact(session.business._id, from, now, session.business.businessValueInputs, product);
  const canEdit = !session.isTeamMember && !session.business.parentOrgId;

  return NextResponse.json({
    status: "ok",
    product,
    inputs: session.business.businessValueInputs,
    impact,
    windowDays: WINDOW_DAYS,
    canEdit,
  });
}

/**
 * Editing is the "top account" only — the actual owner login, never a team
 * member of any tier, and never a branch (a branch's business-value
 * numbers are set centrally by its parent org, same "one place decides"
 * reasoning as the survey builder above it — see /api/group/business-value
 * for that edit path). Viewing stays open to whoever already has page
 * access; this only narrows who can write.
 */
export async function PATCH(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "businessValue" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "businessValue")) {
    return NextResponse.json({ status: "error", message: "Business Value is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember) {
    return NextResponse.json({ status: "error", message: "Only the account owner can edit these figures" }, { status: 403 });
  }
  if (session.business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "Your parent organization sets these figures centrally — ask your Group owner to update them." },
      { status: 403 }
    );
  }

  await connectToDatabase();
  const body = await request.json().catch(() => null);
  const inputs = session.business.businessValueInputs;

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

  await session.business.save();

  return NextResponse.json({ status: "ok", inputs });
}
