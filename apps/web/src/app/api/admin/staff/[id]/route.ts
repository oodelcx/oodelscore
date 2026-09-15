import { NextResponse } from "next/server";
import { connectToDatabase, User, logAuditEvent } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

/** Removes a staff member's access entirely (spec/mockup: "Remove access"). */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.staffAndRoles.delete) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.user._id.toString()) {
    return NextResponse.json({ status: "error", message: "Cannot remove your own access" }, { status: 400 });
  }

  await connectToDatabase();
  const removed = await User.findOneAndDelete({ _id: id, accountType: "admin_staff" });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  await logAuditEvent({
    actor: session.user,
    action: "staff.access_removed",
    targetType: "User",
    targetId: removed._id.toString(),
    targetLabel: removed.email,
  });

  return NextResponse.json({ status: "ok" });
}
