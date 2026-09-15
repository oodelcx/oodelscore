import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase, User, verifyPending2faToken, verifyTwoFactorCode, signSessionToken } from "@oodelscore/shared";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

/** Second step of login when the account has 2FA enabled — exchanges the short-lived
 * pendingToken from /api/auth/login plus a TOTP code for the real session cookie. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pendingToken = typeof body?.pendingToken === "string" ? body.pendingToken : null;
  const code = typeof body?.code === "string" ? body.code.trim() : null;

  if (!pendingToken || !code) {
    return NextResponse.json({ status: "error", message: "pendingToken and code are required" }, { status: 400 });
  }

  const payload = verifyPending2faToken(pendingToken);
  if (!payload) {
    return NextResponse.json({ status: "error", message: "This login attempt has expired. Log in again." }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tokenVersion || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ status: "error", message: "This login attempt is no longer valid. Log in again." }, { status: 401 });
  }

  const valid = await verifyTwoFactorCode(user.twoFactorSecret, code);
  if (!valid) {
    return NextResponse.json({ status: "error", message: "Incorrect code" }, { status: 401 });
  }

  user.lastLoginAt = new Date();
  await user.save();

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

  return NextResponse.json({
    status: "ok",
    user: { id: user._id.toString(), email: user.email, accountType: user.accountType },
  });
}
