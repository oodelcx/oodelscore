import { NextResponse } from "next/server";
import { recordCronRun, connectToDatabase, autoMeasurePendingDecisions, logSystemHealthEvent } from "@oodelscore/shared";

/**
 * Meant to be hit once a day by an external scheduler (a Render Cron Job
 * pointed at this URL, or similar) — there's no in-process job runner in
 * this Next.js app, so nothing calls this on its own. Not user-facing and
 * not tied to any session; protected by a shared secret instead of a login,
 * the same way a webhook is.
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
    const result = await autoMeasurePendingDecisions();
    await recordCronRun("measure-decisions", true, JSON.stringify(result));
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[cron/measure-decisions] failed", err);
    await logSystemHealthEvent("cron_failure", (err as Error).message ?? "measure-decisions failed", {
      route: "measure-decisions",
    });
    await recordCronRun("measure-decisions", false, (err as Error).message ?? "failed");
    return NextResponse.json({ status: "error", message: "Job failed" }, { status: 500 });
  }
}
