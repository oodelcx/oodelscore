import { NextResponse } from "next/server";
import { connectToDatabase, Business, computeThemeIntelligence } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id");
  const businessIds = businesses.map((b) => b._id);
  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const previousFrom = new Date(now.getTime() - WINDOW_DAYS * 2 * DAY_MS);

  const themes = await computeThemeIntelligence(businessIds, from, now, previousFrom, from);

  return NextResponse.json({ status: "ok", themes, windowDays: WINDOW_DAYS });
}
