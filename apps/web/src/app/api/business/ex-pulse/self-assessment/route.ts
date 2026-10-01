import { NextResponse } from "next/server";
import {
  connectToDatabase,
  hasProduct,
  getTeamMemberProducts,
  getSelfAssessment,
  saveSelfAssessment,
  selfAssessmentOwnerFor,
} from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/** Colleague Experience's own quarterly self-assessment — same mechanics as business/cx-pulse/self-assessment, scoped to the colleague_experience product. */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "exPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.business, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember && !getTeamMemberProducts(session.user).includes("colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const owner = selfAssessmentOwnerFor(session.business);
  const view = await getSelfAssessment(owner.ownerType, owner.ownerId, "colleague_experience", owner.editable && !session.isTeamMember);

  return NextResponse.json({ status: "ok", ...view });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "exPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.business, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
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
  await saveSelfAssessment(owner.ownerType, owner.ownerId, "colleague_experience", body.answers);
  const view = await getSelfAssessment(owner.ownerType, owner.ownerId, "colleague_experience", true);

  return NextResponse.json({ status: "ok", ...view });
}
