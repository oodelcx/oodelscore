import { NextResponse } from "next/server";
import { connectToDatabase, Business, CxPulseScore } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

const DIMENSION_KEYS = ["awareness", "response", "ownership", "culture", "outcome"] as const;

/** Branch mode only: this business's own dimension scores vs its region's average. */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.business.parentOrgId) {
    return NextResponse.json({ status: "error", message: "Not part of a parent organization" }, { status: 400 });
  }

  await connectToDatabase();
  const own = await CxPulseScore.findOne({ ownerType: "business", ownerId: session.business._id }).sort({ period: -1 });

  const siblings = await Business.find({
    parentOrgId: session.business.parentOrgId,
    region: session.business.region,
    _id: { $ne: session.business._id },
  }).select("_id");
  const siblingScores = await Promise.all(
    siblings.map((b) => CxPulseScore.findOne({ ownerType: "business", ownerId: b._id }).sort({ period: -1 }))
  );
  const validSiblingScores = siblingScores.filter((s): s is NonNullable<typeof s> => s !== null);

  const regionAverages = Object.fromEntries(
    DIMENSION_KEYS.map((key) => [
      key,
      validSiblingScores.length === 0
        ? null
        : Math.round(validSiblingScores.reduce((sum, s) => sum + s.dimensions[key], 0) / validSiblingScores.length),
    ])
  );

  return NextResponse.json({ status: "ok", own, regionAverages, regionBusinessCount: validSiblingScores.length + 1 });
}
