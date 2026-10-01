import { NextResponse } from "next/server";
import { connectToDatabase, hasFeature, getSelfAssessment, saveSelfAssessment, selfAssessmentOwnerFor } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Customer Experience's quarterly self-assessment for a business/branch.
 * Same "one place decides" ownership as Business Value: a branch doesn't
 * answer its own — its parent org does, once, for the whole network (see
 * selfAssessmentOwnerFor). GET is open to anyone with cxPulse page access
 * so a branch can see what its org answered; POST is owner-only and
 * rejected outright for a branch.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "cxPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "cxPulse")) {
    return NextResponse.json({ status: "error", message: "CX Pulse is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const owner = selfAssessmentOwnerFor(session.business);
  const view = await getSelfAssessment(owner.ownerType, owner.ownerId, "customer_experience", owner.editable && !session.isTeamMember);

  return NextResponse.json({ status: "ok", ...view });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "cxPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "cxPulse")) {
    return NextResponse.json({ status: "error", message: "CX Pulse is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember) {
    return NextResponse.json({ status: "error", message: "Only the account owner can submit the self-assessment" }, { status: 403 });
  }
  const owner = selfAssessmentOwnerFor(session.business);
  if (!owner.editable) {
    return NextResponse.json(
      { status: "error", message: "Your parent organization answers this centrally — ask your Group owner." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.answers)) {
    return NextResponse.json({ status: "error", message: "answers must be an array" }, { status: 400 });
  }

  await connectToDatabase();
  await saveSelfAssessment(owner.ownerType, owner.ownerId, "customer_experience", body.answers);
  const view = await getSelfAssessment(owner.ownerType, owner.ownerId, "customer_experience", true);

  return NextResponse.json({ status: "ok", ...view });
}
