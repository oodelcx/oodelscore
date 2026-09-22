import { NextResponse } from "next/server";
import { connectToDatabase, CxPulseScore , hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "cxPulse")) {
    return NextResponse.json({ status: "error", message: "CX Pulse is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const score = await CxPulseScore.findOne({ ownerType: "business", ownerId: session.business._id }).sort({ period: -1 });
  const history = await CxPulseScore.find({ ownerType: "business", ownerId: session.business._id })
    .sort({ period: -1 })
    .limit(6);
  return NextResponse.json({ status: "ok", score, history });
}
