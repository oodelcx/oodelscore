import { NextResponse } from "next/server";
import { connectToDatabase, hasProduct, getTeamMemberProducts, getSelfAssessment, saveSelfAssessment } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** Colleague Experience's org-level quarterly self-assessment — mirrors group/cx-pulse/self-assessment. */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "exPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.org, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember && !getTeamMemberProducts(session.user).includes("colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const view = await getSelfAssessment("parentOrg", session.org._id, "colleague_experience", !session.isTeamMember);

  return NextResponse.json({ status: "ok", ...view });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "exPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.org, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (session.isTeamMember) {
    return NextResponse.json({ status: "error", message: "Only the account owner can submit the self-assessment" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.answers)) {
    return NextResponse.json({ status: "error", message: "answers must be an array" }, { status: 400 });
  }

  await connectToDatabase();
  await saveSelfAssessment("parentOrg", session.org._id, "colleague_experience", body.answers);
  const view = await getSelfAssessment("parentOrg", session.org._id, "colleague_experience", true);

  return NextResponse.json({ status: "ok", ...view });
}
