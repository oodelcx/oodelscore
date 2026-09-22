import { NextResponse } from "next/server";
import { connectToDatabase, EscalationAssignment } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string; assignmentId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!(session.role.isSystemRole && session.role.name === "Admin")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id, assignmentId } = await params;
  await connectToDatabase();
  const removed = await EscalationAssignment.findOneAndDelete({ _id: assignmentId, businessId: id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
