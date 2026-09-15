import { NextResponse } from "next/server";
import { generateTwoFactorSecret, generateTwoFactorQrCode } from "@oodelscore/shared";
import { getCurrentUser } from "@/lib/session";

/** Starts (or restarts) 2FA setup: generates a new pending secret and returns its QR code.
 * Nothing is enabled until the user scans it and confirms a code via /api/auth/2fa/verify. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const secret = generateTwoFactorSecret();
  user.twoFactorPendingSecret = secret;
  await user.save();

  const qrCodeDataUrl = await generateTwoFactorQrCode(user.email, secret);

  return NextResponse.json({ status: "ok", secret, qrCodeDataUrl });
}
