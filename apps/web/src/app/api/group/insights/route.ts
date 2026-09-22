import { NextResponse } from "next/server";
import { connectToDatabase, AiInsightReport , hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "insights")) {
    return NextResponse.json({ status: "error", message: "Insights is not enabled for this account" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");

  await connectToDatabase();
  const filter: Record<string, unknown> = { ownerType: "parentOrg", ownerId: session.org._id, status: "approved" };
  if (period) filter.period = period;

  const reports = await AiInsightReport.find(filter).sort({ periodStart: -1 }).limit(20);
  return NextResponse.json({ status: "ok", reports });
}
