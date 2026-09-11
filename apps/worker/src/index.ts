import { connectToDatabase, disconnectFromDatabase } from "@oodelscore/shared";

/**
 * Placeholder entry point for the scheduled-jobs worker (spec Section 10a:
 * AI Insights generation, nightly CX Pulse scoring, alert-rule sweeps, data
 * retention). Each job is a separate Render Cron Job invoking this
 * package; the actual job logic lands in later milestones (build order
 * steps 6-8). For now this only proves the worker can reach Mongo.
 */
async function main(): Promise<void> {
  await connectToDatabase();
  console.log("worker: connected to MongoDB");
  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
