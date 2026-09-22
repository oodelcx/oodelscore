import { NextResponse } from "next/server";
import { connectToDatabase, sendCompExpiryReminders } from "@oodelscore/shared";

/**
 * Daily sweep — same shared-secret pattern as the other /api/cron routes.
 * Reminds each comp/pilot account's assigned account manager 7 days before
 * expiry, so there's a real window to convert it before the payment gate
 * would lock the customer out.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ status: "error", message: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const provided = request.headers.get("x-cron-secret");
  if (provided !== secret) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const result = await sendCompExpiryReminders();

  return NextResponse.json({ status: "ok", ...result });
}
