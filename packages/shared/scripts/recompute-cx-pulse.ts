import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { recomputeAllCxPulseScores } from "../src/cxpulse/compute";

/**
 * Command-line equivalent of POST /api/cron/recompute-cx-pulse, for running
 * the recompute by hand. The hosted nightly job (spec Section 7/10a) calls
 * that route. Never compute CX Pulse live in a page request.
 */
async function main(): Promise<void> {
  await connectToDatabase();
  const result = await recomputeAllCxPulseScores();
  console.log(`CX Pulse scores recomputed: ${result.businessesScored} business(es), ${result.parentOrgsScored} parent org(s).`);
  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
