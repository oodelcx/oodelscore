import { NextResponse } from "next/server";
import { connectToDatabase, restartCompassAssessment, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

export async function POST() {
  const session = await requireBusinessOwner({ requirePage: "compass" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "compass")) {
    return NextResponse.json({ status: "error", message: "OodelCX Compass is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  await restartCompassAssessment("business", session.business._id);

  return NextResponse.json({ status: "ok" });
}
