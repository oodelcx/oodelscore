import { NextResponse } from "next/server";
import { connectToDatabase, CxPulseScore, Business } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** Own org score plus each child business's latest score, for region/branch comparisons. */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const orgScore = await CxPulseScore.findOne({ ownerType: "parentOrg", ownerId: session.org._id }).sort({ period: -1 });

  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id name region");
  const businessScores = await Promise.all(
    businesses.map(async (b) => {
      const score = await CxPulseScore.findOne({ ownerType: "business", ownerId: b._id }).sort({ period: -1 });
      return { businessId: b._id.toString(), name: b.name, region: b.region, score };
    })
  );

  return NextResponse.json({ status: "ok", orgScore, businessScores });
}
