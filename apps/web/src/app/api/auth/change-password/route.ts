import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyPassword, hashPassword, signSessionToken, logAuditEvent } from "@oodelscore/shared";
import { getCurrentUser, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

/**
 * Changes the current, already-authenticated user's own password. Works the
 * same for every account type (business/group/admin all reuse this — there's
 * no separate flow per portal). Requires the current password, matching the
 * bar the 2FA-disable route already sets.
 *
 * Reissues the session cookie after bumping tokenVersion, since bumping it
 * (spec Section 3 — invalidates previously issued sessions on password
 * change) would otherwise also invalidate the very request that's making
 * this change.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : null;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { status: "error", message: "currentPassword and newPassword are required" },
      { status: 400 }
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ status: "error", message: "New password must be at least 8 characters" }, { status: 400 });
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ status: "error", message: "Current password is incorrect" }, { status: 401 });

  const samePassword = await verifyPassword(newPassword, user.passwordHash);
  if (samePassword) {
    return NextResponse.json(
      { status: "error", message: "New password must be different from your current password" },
      { status: 400 }
    );
  }

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  if (user.accountType === "admin_staff") {
    await logAuditEvent({
      actor: user,
      action: "user.password_changed",
      targetType: "User",
      targetId: user._id.toString(),
      targetLabel: user.email,
    });
  }

  // Re-issue the session cookie against the new tokenVersion so this same
  // browser stays signed in instead of being logged out by its own change.
  const token = signSessionToken({
    sub: user._id.toString(),
    accountType: user.accountType,
    tokenVersion: user.tokenVersion,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ status: "ok" });
}
