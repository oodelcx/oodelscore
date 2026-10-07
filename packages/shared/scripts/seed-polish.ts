import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { seedShowcasePolish } from "../src/seedData/showcasePolish";

/** Fills empty-looking showcase screens on an already-seeded database. Idempotent. Sends no email. */
async function main(): Promise<void> {
  await connectToDatabase();
  console.log("Showcase polish applied:", await seedShowcasePolish());
  await disconnectFromDatabase();
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
