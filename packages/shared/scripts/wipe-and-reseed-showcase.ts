import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { wipeAllTenantData, seedShowcaseData } from "../src/seedData/showcase";
import { seedPlatformDefaults } from "../src/seedData/platformDefaults";
import { generateDueInsights, ALL_AI_REPORT_PERIODS } from "../src/ai/insightsGeneration";
import { recomputeAllCxPulseScores } from "../src/cxpulse/compute";
import { AiInsightReport } from "../src/models/AiInsightReport";

/**
 * One-off CLI entry point: wipes all tenant data, re-ensures platform
 * defaults (roles/email templates/cx pulse framework), rebuilds the showcase
 * dataset fresh, then generates AI Insight Reports for every owner across
 * every cadence against the real data just seeded — via the live Anthropic
 * API when ANTHROPIC_API_KEY is set (see ai/insightsGeneration.ts), falling
 * back to a deterministic narrative otherwise — and recomputes every
 * owner's CX Pulse score, which otherwise stays empty until the nightly
 * recompute-cx-pulse cron happens to run (staging/sandbox environments
 * usually never get that cron scheduled at all). For staging/sandbox use
 * only.
 *
 * Usage (from packages/shared):
 *   SEED_TARGET_DB=<db name in MONGODB_URI> npx tsx scripts/wipe-and-reseed-showcase.ts
 * Optional: SHOWCASE_RESPONSE_SCALE (default 5 here), SHOWCASE_HISTORY_DAYS (default 660).
 */
async function main(): Promise<void> {
  // Destructive: refuse to run unless the target database is named explicitly,
  // so a wrong MONGODB_URI (e.g. the production cluster) can never be wiped by accident.
  const uri = process.env.MONGODB_URI ?? "";
  const dbName = uri.replace(/\?.*$/, "").split("/").pop() ?? "";
  if (!dbName || process.env.SEED_TARGET_DB !== dbName) {
    throw new Error(`Refusing to wipe: set SEED_TARGET_DB to the database name in MONGODB_URI ("${dbName}") to confirm.`);
  }
  console.log(`Target database: ${dbName}`);
  process.env.SHOWCASE_RESPONSE_SCALE ??= "5";
  process.env.SHOWCASE_HISTORY_DAYS ??= "660";
  await connectToDatabase();

  const wiped = await wipeAllTenantData();
  console.log("Wiped:", wiped);

  await seedPlatformDefaults();
  console.log("Platform defaults ensured.");

  const result = await seedShowcaseData();
  console.log("Seed result:", JSON.stringify(result, null, 2));

  const insights = await generateDueInsights(new Date(), [...ALL_AI_REPORT_PERIODS]);
  console.log("AI Insight Reports:", JSON.stringify(insights, null, 2));

  // Demo data: publish the generated reports so they show on every dashboard
  // (real accounts keep the pending -> admin review -> approve flow).
  const approved = await AiInsightReport.updateMany({ status: "pending" }, { $set: { status: "approved", reviewedAt: new Date() } });
  console.log("Reports approved for demo:", approved.modifiedCount);

  const cxPulse = await recomputeAllCxPulseScores();
  console.log("CX Pulse scores:", JSON.stringify(cxPulse, null, 2));

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
