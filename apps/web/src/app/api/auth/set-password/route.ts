import { NextResponse } from "next/server";
import { connectToDatabase, User, verifySetPasswordToken, hashPassword } from "@oodelscore/shared";

/**
 * Completes either flow that hands out a `{{set_password_link}}` (spec
 * Section 11): the initial invite, or a password reset. Both reuse the same
 * `inviteTokenHash`/`inviteExpiresAt` fields on the user doc (spec Section 2).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const token = typeof body?.token === "string" ? body.token : null;
  const password = typeof body?.password === "string" ? body.password : null;

  if (!userId || !token || !password) {
    return NextResponse.json(
      { status: "error", message: "userId, token, and password are required" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { status: "error", message: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const user = await User.findById(userId);
  if (!user || !verifySetPasswordToken(token, user.inviteTokenHash, user.inviteExpiresAt)) {
    return NextResponse.json({ status: "error", message: "Invalid or expired link" }, { status: 400 });
  }

  user.passwordHash = await hashPassword(password);
  user.inviteStatus = "active";
  user.inviteTokenHash = null;
  user.inviteExpiresAt = null;
  user.tokenVersion += 1; // invalidate any previously issued sessions
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  return NextResponse.json({ status: "ok" });
}
