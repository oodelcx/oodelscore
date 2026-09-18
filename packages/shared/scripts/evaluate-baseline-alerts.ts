import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { evaluateBaselineAlerts } from "../src/alerts/evaluate";

/**
 * Render Cron job, hourly (spec Section 10a): regional_outlier and
 * sudden_drop both need a rolling baseline across more than one data
 * point, unlike fixed_threshold which runs inline on every new
 * response (see apps/web's feedback submit route).
 */
async function main(): Promise<void> {
  await connectToDatabase();
  await evaluateBaselineAlerts();
  console.log("Baseline alert sweep complete.");
  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
