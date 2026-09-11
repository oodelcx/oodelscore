import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { findBillingIntegrityIssues } from "../src/stripe/billing";

/**
 * Spec Section 5 / bug #4: run this as a scheduled job (Render Cron) to
 * catch orphaned billingSubscriptions rows and businesses billed both
 * individually and via their group. Read-only — prints findings, doesn't
 * fix them (a human decides whether to delete or reassign).
 */
async function main(): Promise<void> {
  await connectToDatabase();
  const issues = await findBillingIntegrityIssues();

  if (issues.orphanedSubscriptionIds.length === 0 && issues.groupPaysWithOwnSubscriptionIds.length === 0) {
    console.log("Billing integrity check: no issues found.");
  } else {
    console.log(`Billing integrity check found issues:`);
    console.log(`  Orphaned subscriptions (no resolvable owner): ${issues.orphanedSubscriptionIds.join(", ") || "none"}`);
    console.log(
      `  Businesses billed both individually and via their group: ${issues.groupPaysWithOwnSubscriptionIds.join(", ") || "none"}`
    );
  }

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
