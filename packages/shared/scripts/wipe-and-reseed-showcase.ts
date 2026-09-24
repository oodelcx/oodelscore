import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { wipeAllTenantData, seedShowcaseData } from "../src/seedData/showcase";
import { seedPlatformDefaults } from "../src/seedData/platformDefaults";
import { generateDueInsights, ALL_AI_REPORT_PERIODS } from "../src/ai/insightsGeneration";

/**
 * One-off CLI entry point: wipes all tenant data, re-ensures platform
 * defaults (roles/email templates/cx pulse framework), rebuilds the showcase
 * dataset fresh, then generates AI Insight Reports for every owner across
 * every cadence against the real data just seeded — via the live Anthropic
 * API when ANTHROPIC_API_KEY is set (see ai/insightsGeneration.ts), falling
 * back to a deterministic narrative otherwise. For staging/sandbox use only.
 */
async function main(): Promise<void> {
  await connectToDatabase();

  const wiped = await wipeAllTenantData();
  console.log("Wiped:", wiped);

  await seedPlatformDefaults();
  console.log("Platform defaults ensured.");

  const result = await seedShowcaseData();
  console.log("Seed result:", JSON.stringify(result, null, 2));

  const insights = await generateDueInsights(new Date(), [...ALL_AI_REPORT_PERIODS]);
  console.log("AI Insight Reports:", JSON.stringify(insights, null, 2));

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
