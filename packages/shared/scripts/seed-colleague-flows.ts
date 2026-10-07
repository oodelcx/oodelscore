import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { seedColleagueFlowsDemo } from "../src/seedData/colleagueFlowsDemo";

/**
 * Adds the personal-link, lifecycle and sensitive-comment demo data on top of
 * an already-seeded showcase database. Idempotent. Sends no email.
 * Usage (from packages/shared): npm run seed:colleague-flows
 */
async function main(): Promise<void> {
  await connectToDatabase();
  const result = await seedColleagueFlowsDemo();
  console.log("Colleague flows seeded:", result);
  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
