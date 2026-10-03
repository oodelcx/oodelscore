import { NextResponse } from "next/server";
import {
  connectToDatabase,
  recomputeAllCxPulseScores,
  generateDueInsights,
  ALL_AI_REPORT_PERIODS,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * On-demand equivalent of the recompute-cx-pulse and generate-insights cron
 * jobs, for whenever this environment's scheduler isn't actually reaching
 * it — the GitHub Actions scheduled workflow (.github/workflows/
 * scheduled-jobs.yml) only targets production by default, so a staging or
 * sandbox deployment can go indefinitely without either job ever running,
 * leaving CX Pulse and AI Insights permanently empty even with real
 * response data. Unlike Seed showcase data, this works against whatever is
 * already in the database — no wipe, no reseed, safe to run any time.
 */
export async function POST() {
  const session = await requireStaffSession();
  if (!session || session.role.name !== "Admin") {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const cxPulse = await recomputeAllCxPulseScores();
  const insights = await generateDueInsights(new Date(), [...ALL_AI_REPORT_PERIODS]);
  return NextResponse.json({ status: "ok", cxPulse, insights });
}
