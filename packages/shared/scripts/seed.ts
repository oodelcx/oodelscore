import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { seedPlatformDefaults } from "../src/seedData/platformDefaults";

/**
 * Manual CLI entry point for the platform-wide defaults — connects, seeds,
 * disconnects. The same seeding logic also runs automatically on app boot
 * when SEED_BASE=true (see apps/web/instrumentation.ts); this script is
 * for local/manual use.
 */
async function main(): Promise<void> {
  await connectToDatabase();
  const result = await seedPlatformDefaults();

  for (const name of result.roles) console.log(`role ensured: ${name}`);
  for (const key of result.emailTemplates) console.log(`email template ensured: ${key}`);
  console.log("cx pulse framework ensured");

  await disconnectFromDatabase();
  console.log("seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
