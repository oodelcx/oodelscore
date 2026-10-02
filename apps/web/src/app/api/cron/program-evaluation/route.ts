import { NextResponse } from "next/server";
import { connectToDatabase, generateDueProgramEvaluations, logSystemHealthEvent } from "@oodelscore/shared";

/**
 * Daily. Finds every training Event past its grace period (see
 * PROGRAM_EVALUATION_GRACE_DAYS) belonging to a business with Program
 * Evaluation enabled, and generates its report if it doesn't have one yet.
 * Same shared-secret auth as every other cron route — see
 * ../measure-decisions/route.ts.
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
    const result = await generateDueProgramEvaluations();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[cron/program-evaluation] failed", err);
    await logSystemHealthEvent("cron_failure", (err as Error).message ?? "program-evaluation failed", {
      route: "program-evaluation",
    });
    return NextResponse.json({ status: "error", message: "Job failed" }, { status: 500 });
  }
}
