import { NextResponse } from "next/server";
import { verifyTwoFactorCode, logAuditEvent } from "@oodelscore/shared";
import { getCurrentUser } from "@/lib/session";

/** Confirms setup: the code must match the pending secret from /api/auth/2fa/setup
 * before 2FA actually turns on — proves the user's authenticator app really has it. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!user.twoFactorPendingSecret) {
    return NextResponse.json({ status: "error", message: "Start 2FA setup first" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : null;
  if (!code) return NextResponse.json({ status: "error", message: "code is required" }, { status: 400 });

  const valid = await verifyTwoFactorCode(user.twoFactorPendingSecret, code);
  if (!valid) return NextResponse.json({ status: "error", message: "Incorrect code — try again" }, { status: 400 });

  user.twoFactorSecret = user.twoFactorPendingSecret;
  user.twoFactorPendingSecret = null;
  user.twoFactorEnabled = true;
  await user.save();

  await logAuditEvent({
    actor: user,
    action: "user.2fa_enabled",
    targetType: "User",
    targetId: user._id.toString(),
    targetLabel: user.email,
  });

  return NextResponse.json({ status: "ok" });
}
