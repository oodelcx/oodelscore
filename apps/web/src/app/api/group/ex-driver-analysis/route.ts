import { NextResponse } from "next/server";
import { connectToDatabase, Business, computeDriverAnalysis, hasProduct, getTeamMemberProducts } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

const WINDOW_DAYS = 90;

/** Org-wide version of business/ex-driver-analysis — every CE-enabled branch's colleague responses, pooled. */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "exPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.org, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember && !getTeamMemberProducts(session.user).includes("colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id, active: true }).select("enabledProducts");
  const ceBusinessIds = businesses.filter((b) => hasProduct(b, "colleague_experience")).map((b) => b._id);

  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const drivers = await computeDriverAnalysis(ceBusinessIds, from, now, "colleague_experience");

  return NextResponse.json({ status: "ok", drivers, windowDays: WINDOW_DAYS });
}
