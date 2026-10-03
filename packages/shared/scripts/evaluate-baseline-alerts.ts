import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { evaluateBaselineAlerts } from "../src/alerts/evaluate";

/**
 * Command-line equivalent of POST /api/cron/evaluate-baseline-alerts, for
 * running the sweep by hand; the hosted hourly job (spec Section 10a) calls
 * that route instead.
 *
 * regional_outlier and sudden_drop both need a rolling baseline across more
 * than one data point, unlike fixed_threshold which runs inline on every
 * new response (see apps/web's feedback submit route).
 */
async function main(): Promise<void> {
  await connectToDatabase();
  const result = await evaluateBaselineAlerts();
  console.log(`Baseline alert sweep complete: ${result.rulesEvaluated} rule(s) evaluated, ${result.alertsFired} alert(s) fired.`);
  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
