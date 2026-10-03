import { NextResponse } from "next/server";
import { connectToDatabase, runColleagueLifecycleTriggers, logSystemHealthEvent } from "@oodelscore/shared";

/**
 * Daily sweep — same shared-secret pattern as the other /api/cron routes.
 * Fires Colleague Experience's lifecycle-triggered surveys (onboarding
 * day-30/90, exit) for anyone who's newly due. Currently a no-op for every
 * real account: it requires a business to have both Colleague Experience
 * enabled and a feedback point explicitly set up with a lifecycleTrigger
 * for a given stage, neither of which exists yet on any real account.
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
    const result = await runColleagueLifecycleTriggers();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[cron/ce-lifecycle-triggers] failed", err);
    await logSystemHealthEvent("cron_failure", (err as Error).message ?? "ce-lifecycle-triggers failed", {
      route: "ce-lifecycle-triggers",
    });
    return NextResponse.json({ status: "error", message: "Job failed" }, { status: 500 });
  }
}
