import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { wipeAllTenantData, seedShowcaseData } from "../src/seedData/showcase";
import { seedPlatformDefaults } from "../src/seedData/platformDefaults";

/**
 * One-off CLI entry point: wipes all tenant data, re-ensures platform
 * defaults (roles/email templates/cx pulse framework), then rebuilds the
 * showcase dataset fresh. For staging/sandbox use only.
 */
async function main(): Promise<void> {
  await connectToDatabase();

  const wiped = await wipeAllTenantData();
  console.log("Wiped:", wiped);

  await seedPlatformDefaults();
  console.log("Platform defaults ensured.");

  const result = await seedShowcaseData();
  console.log("Seed result:", JSON.stringify(result, null, 2));

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
