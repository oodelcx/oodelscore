import { NextResponse } from "next/server";
import { connectToDatabase, getSelfAssessment, saveSelfAssessment } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** The org-level answer every branch's CX Pulse Culture score reads from — see selfAssessmentOwnerFor. */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "cxPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const view = await getSelfAssessment("parentOrg", session.org._id, "customer_experience", !session.isTeamMember);

  return NextResponse.json({ status: "ok", ...view });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "cxPulse" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) {
    return NextResponse.json({ status: "error", message: "Only the account owner can submit the self-assessment" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.answers)) {
    return NextResponse.json({ status: "error", message: "answers must be an array" }, { status: 400 });
  }

  await connectToDatabase();
  await saveSelfAssessment("parentOrg", session.org._id, "customer_experience", body.answers);
  const view = await getSelfAssessment("parentOrg", session.org._id, "customer_experience", true);

  return NextResponse.json({ status: "ok", ...view });
}
