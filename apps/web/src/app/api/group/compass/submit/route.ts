import { NextResponse } from "next/server";
import { connectToDatabase, completeCompassAssessment, getEnabledProducts, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function POST() {
  const session = await requireParentOrgOwner({ requirePage: "compass" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "compass")) {
    return NextResponse.json({ status: "error", message: "OodelCX Compass is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const products = getEnabledProducts(session.org);
  const result = await completeCompassAssessment("parentOrg", session.org._id, products);
  if (!result.ok) return NextResponse.json({ status: "error", message: result.message }, { status: 400 });

  return NextResponse.json({ status: "ok" });
}
