import { NextResponse } from "next/server";
import { connectToDatabase, User, Role, sendTemplatedEmail, hasStaffPermission, logAuditEvent } from "@oodelscore/shared";
import { getCurrentUser } from "@/lib/session";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Admin-only: changes a user's login email and notifies the new address
 * (spec Section 11's `email_changed` trigger). Self-service email changes
 * from within the Business/Group portals will call the same trigger once
 * those portals exist — this covers the Admin-side case for now.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.accountType !== "admin_staff") {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const currentRole = currentUser.roleId ? await Role.findById(currentUser.roleId) : null;
  if (!currentRole || !hasStaffPermission(currentRole, "staffAndRoles", "edit")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const newEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  if (!newEmail) {
    return NextResponse.json({ status: "error", message: "A valid email is required" }, { status: 400 });
  }

  const user = await User.findById(id);
  if (!user) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  if (newEmail === user.email) {
    return NextResponse.json({ status: "ok" });
  }

  const existing = await User.findOne({ email: newEmail });
  if (existing) {
    return NextResponse.json({ status: "error", message: "A user with this email already exists" }, { status: 409 });
  }

  const oldEmail = user.email;
  user.email = newEmail;
  user.tokenVersion += 1; // invalidate any sessions issued under the old email
  await user.save();

  await sendTemplatedEmail("email_changed", newEmail, { name: newEmail, email: newEmail });

  await logAuditEvent({
    actor: currentUser,
    action: "user.email_changed",
    targetType: "User",
    targetId: user._id.toString(),
    targetLabel: newEmail,
    before: { email: oldEmail },
    after: { email: newEmail },
  });

  return NextResponse.json({ status: "ok" });
}
