import { NextResponse } from "next/server";
import { connectToDatabase, AiInsightReport, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

/** Only ever "approved" — pending reports are never visible on a dashboard (spec Section 10). */
export async function GET(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "insights" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "insights")) {
    return NextResponse.json({ status: "error", message: "Insights is not enabled for this account" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");

  await connectToDatabase();
  // A dual-product business now gets a separate report per product (see
  // insightsGeneration.ts) — show whichever one matches the active tab,
  // not a mix of both.
  const product = await resolveViewProduct(session.business);
  const filter: Record<string, unknown> = { ownerType: "business", ownerId: session.business._id, product, status: "approved" };
  if (period) filter.period = period;

  const reports = await AiInsightReport.find(filter).sort({ periodStart: -1 }).limit(20);
  return NextResponse.json({ status: "ok", reports });
}
