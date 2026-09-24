import { NextResponse } from "next/server";
import { connectToDatabase, computeDriverAnalysis } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

const WINDOW_DAYS = 90;

/**
 * "What's driving your score" — ranks categories by how strongly they
 * correlate with the rest of a response's rating, not just their raw
 * average. Pure statistics on data already in `responses`, no AI call.
 */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const drivers = await computeDriverAnalysis([session.business._id], from, now, "customer_experience");

  return NextResponse.json({ status: "ok", drivers, windowDays: WINDOW_DAYS });
}
