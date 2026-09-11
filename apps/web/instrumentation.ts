/**
 * Runs once when a new server instance boots, before it starts handling
 * requests (Next.js instrumentation hook — no Start Command changes needed
 * to enable either flag below; just set the env var on Render and restart).
 *
 * - SEED_BASE=true: seeds the platform-wide defaults (system roles, email
 *   templates, CX Pulse framework — see seedPlatformDefaults). Must run
 *   before SEED_DEMO, since the demo seed depends on the "Admin" role
 *   existing.
 * - SEED_DEMO=true: ensures the four demo login accounts exist (see
 *   seedDemoAccounts).
 *
 * Both are idempotent, so leaving either flag set across restarts is
 * harmless — just unnecessary extra writes. Turn them back off once seeded.
 *
 * Failure here must never block the app from starting: on a Mongo hiccup
 * (or, for SEED_DEMO, a missing Admin role because SEED_BASE hasn't run
 * yet), log and move on rather than throwing.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const seedBase = process.env.SEED_BASE === "true";
  const seedDemo = process.env.SEED_DEMO === "true";
  if (!seedBase && !seedDemo) return;

  const { connectToDatabase, seedPlatformDefaults, seedDemoAccounts } = await import("@oodelscore/shared");

  if (seedBase) {
    try {
      await connectToDatabase();
      const result = await seedPlatformDefaults();
      console.log(
        `[seed:base] SEED_BASE=true — platform defaults ensured: ${result.roles.length} roles, ${result.emailTemplates.length} email templates, CX Pulse framework`
      );
    } catch (err) {
      console.error("[seed:base] Failed to seed platform defaults on boot:", err);
    }
  }

  if (seedDemo) {
    try {
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
}
