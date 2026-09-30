import { NextResponse } from "next/server";
import { connectToDatabase, restartCompassAssessment, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function POST() {
  const session = await requireParentOrgOwner({ requirePage: "compass" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "compass")) {
    return NextResponse.json({ status: "error", message: "OodelCX Compass is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  await restartCompassAssessment("parentOrg", session.org._id);

  return NextResponse.json({ status: "ok" });
}
