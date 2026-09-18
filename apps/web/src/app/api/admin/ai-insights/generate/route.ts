import { NextResponse } from "next/server";
import { connectToDatabase, generateDueInsights, AI_REPORT_PERIODS, ALL_AI_REPORT_PERIODS, type AiReportPeriod } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const PERIOD_SET: readonly string[] = AI_REPORT_PERIODS;

/**
 * Admin's manual trigger for the same generation the daily cron
 * (/api/cron/generate-insights) runs — for testing, demos, or catching up
 * after a missed scheduled run. Unlike the cron route, which only
 * generates whatever's naturally due "today", a manual click defaults to
 * running every period (weekly/monthly/quarterly/yearly) right now,
 * because "run it if I need to" implies not waiting on the calendar.
 * Already-generated owner/period/periodStart combinations are skipped
 * either way (generateDueInsights is idempotent), so clicking this after
 * the cron already ran today is a safe no-op.
 */
export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const permission = session.role.permissions.aiInsightsQueue;
  if (!permission.edit) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  let periods: AiReportPeriod[] | undefined;
  if (Array.isArray(body?.periods)) {
    if (!body.periods.every((p: unknown) => typeof p === "string" && PERIOD_SET.includes(p))) {
      return NextResponse.json({ status: "error", message: "Invalid periods" }, { status: 400 });
    }
    periods = body.periods;
  } else {
    periods = [...ALL_AI_REPORT_PERIODS];
  }

  await connectToDatabase();
  const result = await generateDueInsights(new Date(), periods);

  return NextResponse.json({ status: "ok", ...result });
}
