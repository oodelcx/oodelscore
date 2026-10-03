import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { getStripeClient } from "../src/stripe/client";
import { computeSubscriptionMrr } from "../src/stripe/billing";
import { BillingSubscription } from "../src/models/BillingSubscription";

/**
 * One-off repair for rows written before the Stripe webhook recorded
 * `mrrValue` (see handleStripeWebhookEvent): every real paying customer
 * was persisted at the schema default of 0, so Billing Oversight's
 * "Platform MRR" tile and its by-plan breakdown counted only the
 * demo-seeded accounts.
 *
 * Re-reads each non-comp subscription from Stripe — Stripe is the source
 * of truth for what a customer is actually being charged — and rewrites
 * `mrrValue` to match. Deliberately touches nothing else: plan, status and
 * nextPaymentDate are kept up to date by the webhook from here on, and a
 * one-off script has no business overwriting a field an Admin may have
 * adjusted by hand.
 *
 * Dry run by default: it prints what it would change and writes nothing.
 * Pass --apply to commit the changes.
 *
 *   npm run backfill:subscription-mrr             # report only
 *   npm run backfill:subscription-mrr -- --apply  # write
 *
 * Safe to run more than once — it recomputes from Stripe each time rather
 * than adjusting whatever is already stored.
 */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const stripe = getStripeClient();

  await connectToDatabase();

  const subscriptions = await BillingSubscription.find({ isComp: { $ne: true } });

  let changed = 0;
  let unchanged = 0;
  const missingSubscriptionId: string[] = [];
  const notFoundInStripe: string[] = [];

  for (const row of subscriptions) {
    if (!row.stripeSubscriptionId) {
      missingSubscriptionId.push(`${row.ownerType}/${row.ownerId.toString()}`);
      continue;
    }

    let stripeSubscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
    } catch (err) {
      notFoundInStripe.push(`${row.stripeSubscriptionId} (${(err as Error).message})`);
      continue;
    }

    const canceled = stripeSubscription.status === "canceled";
    const mrrValue = canceled ? 0 : computeSubscriptionMrr(stripeSubscription);

    if (Math.abs(mrrValue - row.mrrValue) < 0.005) {
      unchanged += 1;
      continue;
    }

    console.log(
      `${apply ? "UPDATE" : "WOULD UPDATE"} ${row.ownerType}/${row.ownerId.toString()} ` +
        `[${row.plan || "unknown plan"}] mrrValue ${row.mrrValue.toFixed(2)} -> ${mrrValue.toFixed(2)}`
    );

    if (apply) {
      row.mrrValue = mrrValue;
      await row.save();
    }
    changed += 1;
  }

  console.log("");
  console.log(`Subscriptions examined: ${subscriptions.length}`);
  console.log(`  Already correct: ${unchanged}`);
  console.log(`  ${apply ? "Updated" : "Would update"}: ${changed}`);

  if (missingSubscriptionId.length > 0) {
    console.log(`  No stripeSubscriptionId, skipped (needs a look by hand): ${missingSubscriptionId.join(", ")}`);
  }
  if (notFoundInStripe.length > 0) {
    console.log(`  Could not be read from Stripe, skipped: ${notFoundInStripe.join(", ")}`);
  }

  if (!apply && changed > 0) {
    console.log("");
    console.log("Dry run — nothing was written. Re-run with --apply to commit these changes.");
  }

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
