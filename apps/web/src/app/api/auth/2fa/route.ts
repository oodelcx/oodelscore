import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

/** Current user's 2FA status, for the Security settings screen. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  return NextResponse.json({ status: "ok", twoFactorEnabled: user.twoFactorEnabled });
}
