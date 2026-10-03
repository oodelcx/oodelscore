import { NextResponse } from "next/server";
import { connectToDatabase, Business, computeHighlights, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

const WINDOW_DAYS = 90;

export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "highlights" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "highlights")) {
    return NextResponse.json({ status: "error", message: "Highlights is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const product = await resolveViewProduct(session.org);
  const org = session.org;

  const businesses = await Business.find({ parentOrgId: org._id }).select("_id");
  const businessIds = businesses.map((b) => b._id);

  const to = new Date();
  const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const result = await computeHighlights(businessIds, from, to, product);
  return NextResponse.json({ status: "ok", product, ...result });
}
