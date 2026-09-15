import { NextResponse } from "next/server";
import { verifyPassword, logAuditEvent } from "@oodelscore/shared";
import { getCurrentUser } from "@/lib/session";

/** Requires the current password (not just being logged in) since this removes a
 * security control — the same bar as changing a password, not a casual toggle. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : null;
  if (!password) return NextResponse.json({ status: "error", message: "password is required" }, { status: 400 });

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return NextResponse.json({ status: "error", message: "Incorrect password" }, { status: 401 });

  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  user.twoFactorPendingSecret = null;
  await user.save();

  await logAuditEvent({
    actor: user,
    action: "user.2fa_disabled",
    targetType: "User",
    targetId: user._id.toString(),
    targetLabel: user.email,
  });

  return NextResponse.json({ status: "ok" });
}
