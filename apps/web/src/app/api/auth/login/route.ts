import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase, User, verifyPassword, signSessionToken } from "@oodelscore/shared";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function invalidCredentials() {
  return NextResponse.json({ status: "error", message: "Invalid email or password" }, { status: 401 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const password = typeof body?.password === "string" ? body.password : null;

  if (!email || !password) {
    return NextResponse.json({ status: "error", message: "email and password are required" }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email });

  // Same response whether the account exists or not, to avoid leaking
  // which emails are registered.
  if (!user) return invalidCredentials();

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return NextResponse.json(
      { status: "error", message: "Too many failed attempts. Try again later." },
      { status: 423 }
    );
  }

  // Spec Section 13 bug #3: flip a lapsed invite to "invite_expired" here
  // (not just in admin listings) so a stale link gives an accurate reason.
  if (user.inviteStatus === "invite_pending" && user.inviteExpiresAt && user.inviteExpiresAt.getTime() < Date.now()) {
    user.inviteStatus = "invite_expired";
    await user.save();
  }

  if (user.inviteStatus === "invite_expired") {
    return NextResponse.json(
      { status: "error", message: "Your invite link has expired. Ask an admin to resend it." },
      { status: 403 }
    );
  }

  if (user.inviteStatus !== "active") {
    return NextResponse.json(
      { status: "error", message: "Account is not active yet — check your invite email." },
      { status: 403 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    return invalidCredentials();
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
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
