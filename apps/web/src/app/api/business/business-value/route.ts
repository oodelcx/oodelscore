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

  return NextResponse.json({ status: "ok", product, inputs: session.business.businessValueInputs, impact, windowDays: WINDOW_DAYS });
}

export async function PATCH(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "businessValue" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "businessValue")) {
    return NextResponse.json({ status: "error", message: "Business Value is not enabled for this account" }, { status: 403 });
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
