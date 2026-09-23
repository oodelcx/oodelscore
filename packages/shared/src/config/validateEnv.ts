/**
 * Startup env-var check — logs clearly at boot instead of letting a missing
 * var fail silently the first time some unrelated code path first touches
 * it (e.g. a customer's first Stripe checkout attempt). Never throws: this
 * repo's own convention (see apps/web/instrumentation.ts) is that boot-time
 * checks must never block the app from starting, only make a problem loud
 * and immediate instead of discovered later.
 */
const REQUIRED_VARS = ["MONGODB_URI", "JWT_SECRET"] as const;

const RECOMMENDED_VARS = ["APP_URL", "RESEND_API_KEY", "STRIPE_SECRET_KEY", "ANTHROPIC_API_KEY"] as const;

export function validateEnv(): void {
  const missingRequired = REQUIRED_VARS.filter((key) => !process.env[key]);
  const missingRecommended = RECOMMENDED_VARS.filter((key) => !process.env[key]);

  if (missingRequired.length > 0) {
    console.error(
      `[env] MISSING REQUIRED ENV VAR(S): ${missingRequired.join(", ")} — the app will start but core functionality (database access and/or session auth) will fail on first use. Set these now, see .env.example.`
    );
  }
  if (missingRecommended.length > 0) {
    console.warn(
      `[env] Missing recommended env var(s): ${missingRecommended.join(", ")} — the features that depend on these (email sends, billing, AI features) will silently no-op or error when a user hits them. See .env.example.`
    );
  }
  if (missingRequired.length === 0 && missingRecommended.length === 0) {
    console.log("[env] All required and recommended environment variables are set.");
  }
}
