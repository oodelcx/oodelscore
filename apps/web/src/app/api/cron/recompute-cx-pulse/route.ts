import { NextResponse } from "next/server";
import { connectToDatabase, recomputeAllCxPulseScores, logSystemHealthEvent } from "@oodelscore/shared";

/**
 * Meant to be hit nightly by an external scheduler (a Render Cron Job
 * pointed at this URL), same pattern as /api/cron/generate-insights — a
 * shared-secret-protected route, not a session-authenticated one.
 *
 * CX Pulse aggregates across too many collections to be computed live in a
 * page request (spec Section 7), so the dashboards read whatever this job
 * last wrote. `npm run recompute:cx-pulse` runs the same job as a one-off
 * from a shell; this is how the hosted scheduler reaches it.
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
    const result = await recomputeAllCxPulseScores();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[cron/recompute-cx-pulse] failed", err);
    await logSystemHealthEvent("cron_failure", (err as Error).message ?? "recompute-cx-pulse failed", {
      route: "recompute-cx-pulse",
    });
    return NextResponse.json({ status: "error", message: "Job failed" }, { status: 500 });
  }
}
