import Stripe from "stripe";

let cachedClient: Stripe | null = null;

/**
 * Lazily-initialized singleton — avoids constructing a Stripe client (and
 * throwing on a missing key) at module-import time, same reasoning as
 * connectToDatabase() reusing a single connection.
 */
export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  cachedClient = new Stripe(apiKey);
  return cachedClient;
}
