import { NextResponse } from "next/server";
import { connectToDatabase, EscalationAssignment } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ assignmentId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json({ status: "error", message: "Your parent organization manages escalation centrally." }, { status: 403 });
  }

  await connectToDatabase();
  const { assignmentId } = await params;
  const removed = await EscalationAssignment.findOneAndDelete({ _id: assignmentId, businessId: session.business._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
