import { NextResponse } from "next/server";
import { connectToDatabase, computeDriverAnalysis, hasProduct, getTeamMemberProducts } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

const WINDOW_DAYS = 90;

/**
 * Colleague Experience's own "what's driving this" — same correlation
 * engine as CX's driver analysis (packages/shared/src/scoring/drivers.ts),
 * scoped to product: "colleague_experience" so it never mixes with
 * customer ratings.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "exPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.business, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember && !getTeamMemberProducts(session.user).includes("colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const drivers = await computeDriverAnalysis([session.business._id], from, now, "colleague_experience");

  return NextResponse.json({ status: "ok", drivers, windowDays: WINDOW_DAYS });
}
