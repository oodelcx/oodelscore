import { NextResponse } from "next/server";
import { connectToDatabase, computeThemeIntelligence } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const product = await resolveViewProduct(session.business);
  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const previousFrom = new Date(now.getTime() - WINDOW_DAYS * 2 * DAY_MS);

  const themes = await computeThemeIntelligence([session.business._id], from, now, previousFrom, from, product);

  return NextResponse.json({ status: "ok", themes, windowDays: WINDOW_DAYS, product });
}
