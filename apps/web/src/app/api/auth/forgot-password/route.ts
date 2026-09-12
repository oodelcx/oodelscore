import { NextResponse } from "next/server";
import { connectToDatabase, User, generateSetPasswordToken, sendTemplatedEmail } from "@oodelscore/shared";

/**
 * Public: requests a password-reset link (spec Section 11 `password_reset`
 * trigger). Always responds 200 regardless of whether the email matches an
 * account, or whether that account is active — avoids leaking which emails
 * are registered.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  if (!email) {
    return NextResponse.json({ status: "error", message: "email is required" }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email, inviteStatus: "active" });

  if (user) {
    const { token, hash, expiresAt } = generateSetPasswordToken();
    user.inviteTokenHash = hash;
    user.inviteExpiresAt = expiresAt;
    await user.save();

    const resetLink = `${process.env.APP_URL ?? ""}/set-password?uid=${user._id.toString()}&token=${token}`;
    await sendTemplatedEmail("password_reset", user.email, { name: user.email, reset_link: resetLink });
  }

  return NextResponse.json({ status: "ok" });
}
