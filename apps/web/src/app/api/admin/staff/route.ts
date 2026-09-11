import { NextResponse } from "next/server";
import { connectToDatabase, User } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.staffAndRoles.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const staff = await User.find({ accountType: "admin_staff" })
    .select("-passwordHash -inviteTokenHash")
    .populate("roleId", "name")
    .sort({ createdAt: 1 });

  return NextResponse.json({ status: "ok", staff });
}
