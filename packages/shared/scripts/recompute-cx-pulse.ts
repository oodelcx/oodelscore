import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { recomputeAllCxPulseScores } from "../src/cxpulse/compute";

/** Render Cron job, nightly (spec Section 7/10a). Never compute CX Pulse live in a page request. */
async function main(): Promise<void> {
  await connectToDatabase();
  await recomputeAllCxPulseScores();
  console.log("CX Pulse scores recomputed.");
  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
