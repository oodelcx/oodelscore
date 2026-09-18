import { NextResponse } from "next/server";
import { connectToDatabase, evaluateBaselineAlerts } from "@oodelscore/shared";

/**
 * Meant to be hit hourly by an external scheduler (a Render Cron Job
 * pointed at this URL), same pattern as /api/cron/generate-insights — a
 * shared-secret-protected route, not a session-authenticated one.
 *
 * regional_outlier and sudden_drop rules need a rolling baseline across
 * more than one data point, so unlike fixed_threshold (evaluated inline on
 * every new response) they have nothing to run them except this sweep.
 * `npm run evaluate:baseline-alerts` runs the same job as a one-off from a
 * shell; this is how the hosted scheduler reaches it.
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
  const result = await evaluateBaselineAlerts();

  return NextResponse.json({ status: "ok", ...result });
}
