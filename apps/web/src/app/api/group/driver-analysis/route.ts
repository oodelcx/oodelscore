import { NextResponse } from "next/server";
import { connectToDatabase, Business, computeDriverAnalysis } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

const WINDOW_DAYS = 90;

/** Same "what's driving your score" analysis, aggregated across every branch in the org. */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id");
  const businessIds = businesses.map((b) => b._id);
  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const drivers = await computeDriverAnalysis(businessIds, from, now, "customer_experience");

  return NextResponse.json({ status: "ok", drivers, windowDays: WINDOW_DAYS });
}
