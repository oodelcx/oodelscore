import { NextResponse } from "next/server";
import { connectToDatabase, AiInsightReport , hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct, isCustomerViewProduct } from "@/lib/viewProduct";

export async function GET(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "insights" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!(await isCustomerViewProduct(session.org))) {
    return NextResponse.json({ status: "error", message: "This page is not available for Colleague Experience." }, { status: 403 });
  }
  if (!hasFeature(session.org.enabledFeatures, "insights")) {
    return NextResponse.json({ status: "error", message: "Insights is not enabled for this account" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");

  await connectToDatabase();
  // See the business route's identical comment — one report per product now.
  const product = await resolveViewProduct(session.org);
  const filter: Record<string, unknown> = { ownerType: "parentOrg", ownerId: session.org._id, product, status: "approved" };
  if (period) filter.period = period;

  const reports = await AiInsightReport.find(filter).sort({ periodStart: -1 }).limit(20);
  return NextResponse.json({ status: "ok", reports });
}
