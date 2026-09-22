import { NextResponse } from "next/server";
import { connectToDatabase, generateDueInsights, logSystemHealthEvent } from "@oodelscore/shared";

/**
 * Meant to be hit once a day by an external scheduler (a Render Cron Job
 * pointed at this URL), same pattern as /api/cron/measure-decisions — a
 * shared-secret-protected route, not a session-authenticated one.
 *
 * One daily job rather than four separate weekly/monthly/quarterly/yearly
 * cron schedules: generateDueInsights() figures out from the date itself
 * which periods are due (see duePeriodsFor), so Jan 1 — simultaneously the
 * start of a new week, month, quarter, and year — generates all four
 * correctly instead of needing four independently-configured schedules to
 * agree on that overlap.
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
    const result = await generateDueInsights();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[cron/generate-insights] failed", err);
    await logSystemHealthEvent("cron_failure", (err as Error).message ?? "generate-insights failed", {
      route: "generate-insights",
    });
    return NextResponse.json({ status: "error", message: "Job failed" }, { status: 500 });
  }
}
