import { NextResponse } from "next/server";
import { connectToDatabase, autoEscalateOverdueCases, logSystemHealthEvent } from "@oodelscore/shared";

/**
 * Hourly sweep: any open Action Board item that's been sitting at its
 * current escalation level longer than its owner's configured
 * escalationSlaHours gets bumped one level automatically, same
 * shared-secret pattern as the other /api/cron routes.
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
  try {
    const result = await autoEscalateOverdueCases();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[cron/auto-escalate-cases] failed", err);
    await logSystemHealthEvent("cron_failure", (err as Error).message ?? "auto-escalate-cases failed", {
      route: "auto-escalate-cases",
    });
    return NextResponse.json({ status: "error", message: "Job failed" }, { status: 500 });
  }
}
