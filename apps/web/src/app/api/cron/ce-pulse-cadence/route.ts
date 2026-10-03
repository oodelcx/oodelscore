import { NextResponse } from "next/server";
import { connectToDatabase, runColleagueRosterPulseCadence, logSystemHealthEvent } from "@oodelscore/shared";

/**
 * Daily sweep — same shared-secret pattern as the other /api/cron routes.
 * Sends Colleague Experience's recurring roster-personalized pulse survey
 * (weekly/monthly cadence) to anyone newly due, reusing the same manual
 * "send now" path a business can also trigger itself. A no-op for every
 * account without a roster_personalized feedback point with a pulseCadence
 * set.
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
    const result = await runColleagueRosterPulseCadence();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[cron/ce-pulse-cadence] failed", err);
    await logSystemHealthEvent("cron_failure", (err as Error).message ?? "ce-pulse-cadence failed", {
      route: "ce-pulse-cadence",
    });
    return NextResponse.json({ status: "error", message: "Job failed" }, { status: 500 });
  }
}
