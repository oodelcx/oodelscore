import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { seedDemoAccounts } from "../src/seedData/demoAccounts";

/**
 * Manual CLI entry point for the demo fixtures — connects, seeds, prints
 * credentials, disconnects. The same seeding logic also runs automatically
 * on app boot when SEED_DEMO=true (see apps/web/instrumentation.ts); this
 * script is for local/manual use.
 */
async function main(): Promise<void> {
  await connectToDatabase();
  const accounts = await seedDemoAccounts();

  console.log("Demo accounts ready:");
  for (const acc of accounts) {
    console.log(`  ${acc.label.padEnd(24)} ${acc.email}  /  ${acc.password}`);
  }

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
