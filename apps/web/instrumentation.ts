/**
 * Runs once when a new server instance boots, before it starts handling
 * requests (Next.js instrumentation hook — no Start Command changes needed
 * to enable this).
 *
 * When SEED_DEMO=true is set, ensures the four demo login accounts exist
 * (see @oodelscore/shared's seedDemoAccounts and packages/shared/scripts/
 * seed-demo.ts for the CLI equivalent). Idempotent, so leaving the flag set
 * across restarts is harmless — just unnecessary extra writes. Turn it back
 * off once you've seeded.
 *
 * Failure here must never block the app from starting: on a Mongo hiccup at
 * boot, log and move on rather than throwing.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SEED_DEMO !== "true") return;

  try {
    const { connectToDatabase, seedDemoAccounts } = await import("@oodelscore/shared");
    await connectToDatabase();
    const accounts = await seedDemoAccounts();
    console.log(
      `[seed:demo] SEED_DEMO=true — demo accounts ensured (${accounts.length}): ${accounts
        .map((a) => a.email)
        .join(", ")}`
    );
  } catch (err) {
    console.error("[seed:demo] Failed to seed demo accounts on boot:", err);
  }
}
