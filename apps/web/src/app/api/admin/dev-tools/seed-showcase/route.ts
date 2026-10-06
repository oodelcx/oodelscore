import { NextResponse } from "next/server";
import {
  connectToDatabase,
  seedShowcaseData,
  generateDueInsights,
  ALL_AI_REPORT_PERIODS,
  recomputeAllCxPulseScores,
  AiInsightReport,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

// Demo-sized dataset: ~5x the responses per feedback point, spread over ~22
// months so last week / month / quarter / calendar year all have real data
// for the AI Insight Reports. Override with these env vars if needed.
process.env.SHOWCASE_RESPONSE_SCALE ??= "5";
process.env.SHOWCASE_HISTORY_DAYS ??= "660";

/**
 * Fills the database with a realistic multi-organization showcase (a bank
 * group, a telecom, a school trust, an airline, a hospital network, and
 * standalone businesses spanning Customer Experience, Colleague Experience,
 * and both) so a new Admin can click through every page and see real,
 * connected data instead of empty states. Also generates AI Insight Reports
 * for every owner across every cadence against the data just seeded — via
 * the live Claude API when ANTHROPIC_API_KEY is set, falling back to a
 * deterministic narrative otherwise (see ai/insightsGeneration.ts) — and
 * recomputes every owner's CX Pulse score, which otherwise stays
 * permanently empty on a fresh environment until the nightly
 * recompute-cx-pulse cron happens to run against it (a staging/demo
 * environment usually never gets that cron scheduled at all — see
 * .github/workflows/scheduled-jobs.yml, which only targets production).
 * Gated behind ENABLE_DEV_DATA_TOOLS=true and the "Admin" system role —
 * never available unless the deploying environment explicitly opts in.
 */
export async function POST() {
  if (process.env.ENABLE_DEV_DATA_TOOLS !== "true") {
    return NextResponse.json({ status: "error", message: "Dev Data Tools are not enabled in this environment" }, { status: 403 });
  }
  const session = await requireStaffSession();
  if (!session || session.role.name !== "Admin") {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const result = await seedShowcaseData(session.user._id);
  const insights = await generateDueInsights(new Date(), [...ALL_AI_REPORT_PERIODS]);
  // Demo data: publish the generated reports so they show on every dashboard.
  const approved = await AiInsightReport.updateMany({ status: "pending" }, { $set: { status: "approved", reviewedAt: new Date() } });
  const cxPulse = await recomputeAllCxPulseScores();
  return NextResponse.json({ status: "ok", result, insights, reportsApproved: approved.modifiedCount, cxPulse });
}
