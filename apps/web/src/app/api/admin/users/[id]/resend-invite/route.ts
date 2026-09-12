import { NextResponse } from "next/server";
import {
  connectToDatabase,
  User,
  Role,
  generateSetPasswordToken,
  hashPassword,
  sendTemplatedEmail,
  hasStaffPermission,
} from "@oodelscore/shared";
import { getCurrentUser } from "@/lib/session";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Admin-only: issues a fresh 7-day invite token and re-sends the `welcome`
 * email — the fix for spec Section 13 bug #3 (a lapsed invite previously
 * had no recovery path other than deleting and recreating the account).
 */
export async function POST(_request: Request, { params }: RouteParams) {
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
  const user = await User.findById(id);
  if (!user) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  if (user.inviteStatus === "active") {
    return NextResponse.json({ status: "error", message: "This account is already active" }, { status: 400 });
  }

  const { token, hash, expiresAt } = generateSetPasswordToken();
  user.passwordHash = await hashPassword(token); // placeholder, same as initial invite
  user.inviteStatus = "invite_pending";
  user.inviteTokenHash = hash;
  user.inviteExpiresAt = expiresAt;
  await user.save();

  const setPasswordLink = `${process.env.APP_URL ?? ""}/set-password?uid=${user._id.toString()}&token=${token}`;

  await sendTemplatedEmail("welcome", user.email, {
    name: user.email,
    email: user.email,
    set_password_link: setPasswordLink,
  });

  return NextResponse.json({ status: "ok" });
}
