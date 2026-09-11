import Stripe from "stripe";

/**
 * One-time setup: creates the two test-mode Products/Prices this app's
 * checkout flow needs (business_monthly, business_yearly), if they don't
 * already exist (idempotent via a metadata tag). Prints the resulting
 * Price IDs to set as STRIPE_PRICE_ID_MONTHLY / STRIPE_PRICE_ID_YEARLY.
 *
 * Placeholder amounts — adjust anytime in the Stripe Dashboard, this is
 * test mode with no real money involved either way.
 */
async function main(): Promise<void> {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!apiKey.startsWith("sk_test_")) {
    throw new Error("Refusing to run against a non-test-mode key (must start with sk_test_)");
  }

  const stripe = new Stripe(apiKey);

  async function findOrCreate(nickname: string, unitAmount: number, interval: "month" | "year") {
    const existingPrices = await stripe.prices.list({ lookup_keys: [nickname], limit: 1 });
    if (existingPrices.data.length > 0) {
      console.log(`${nickname} already exists: ${existingPrices.data[0].id}`);
      return existingPrices.data[0].id;
    }

    const product = await stripe.products.create({ name: `Oodel Score — ${nickname}` });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency: "usd",
      recurring: { interval },
      lookup_key: nickname,
    });
    console.log(`Created ${nickname}: ${price.id} ($${unitAmount / 100}/${interval})`);
    return price.id;
  }

  const monthlyId = await findOrCreate("business_monthly", 4900, "month");
  const yearlyId = await findOrCreate("business_yearly", 49000, "year");

  console.log("\nSet these on Render:");
  console.log(`STRIPE_PRICE_ID_MONTHLY=${monthlyId}`);
  console.log(`STRIPE_PRICE_ID_YEARLY=${yearlyId}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
