import { NextResponse } from "next/server";
import { connectToDatabase, computeHighlights, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

const WINDOW_DAYS = 90;

export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "highlights" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "highlights")) {
    return NextResponse.json({ status: "error", message: "Highlights is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const product = await resolveViewProduct(session.business);
  const to = new Date();
  const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const result = await computeHighlights([session.business._id], from, to, product);
  return NextResponse.json({ status: "ok", product, ...result });
}
