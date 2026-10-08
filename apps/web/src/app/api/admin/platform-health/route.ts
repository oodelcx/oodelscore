import { NextResponse } from "next/server";
import { connectToDatabase, SystemHealthEvent, CronRun, CRON_JOBS, findStuckOnboardingAccounts } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Platform Health (Phase 5 item 20) — failed webhooks, failed billing
 * syncs, failed cron runs, and accounts stuck mid-onboarding. Same gate as
 * Audit Log (staffAndRoles.view): this is staff-internal observability,
 * not a customer-facing feature, so it doesn't need its own RolePermissions
 * key.
 */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.staffAndRoles.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const [events, stuckOnboarding] = await Promise.all([
    SystemHealthEvent.find().sort({ occurredAt: -1 }).limit(100).lean(),
    findStuckOnboardingAccounts(),
  ]);

  const runs = await CronRun.find().lean();
  const runByJob = new Map(runs.map((r) => [r.job, r]));
  const now = Date.now();
  const cronJobs = CRON_JOBS.map((j) => {
    const r = runByJob.get(j.job);
    const ageHours = r ? (now - new Date(r.lastRunAt).getTime()) / 3_600_000 : null;
    const state = !r ? "never_ran" : !r.lastOk ? "failed" : ageHours! > j.maxAgeHours ? "overdue" : "ok";
    return { ...j, lastRunAt: r?.lastRunAt ?? null, lastOk: r?.lastOk ?? null, lastMessage: r?.lastMessage ?? "", state };
  });

  // Presence only. Values are never returned.
  const has = (name: string) => Boolean(process.env[name]);
  const setup = [
    { name: "Email sending", ok: has("RESEND_API_KEY"), fix: "Set RESEND_API_KEY (and RESEND_FROM_EMAIL on a verified domain) in Render. Without it no invite, alert, case or recommendation email is sent." },
    { name: "AI features", ok: has("ANTHROPIC_API_KEY"), fix: "Set ANTHROPIC_API_KEY in Render. Without it AI Insights, themes and Program Evaluation do nothing." },
    { name: "Scheduled jobs secret", ok: has("CRON_SECRET"), fix: "Set CRON_SECRET in Render and send it in the x-cron-secret header from each Render Cron Job." },
    { name: "Stripe", ok: has("STRIPE_SECRET_KEY"), fix: "Set STRIPE_SECRET_KEY." },
    { name: "Stripe webhook", ok: has("STRIPE_WEBHOOK_SECRET"), fix: "Register /api/webhooks/stripe in Stripe and set STRIPE_WEBHOOK_SECRET." },
    { name: "Site address", ok: has("APP_URL"), fix: "Set APP_URL so links in emails open the right site." },
  ];

  return NextResponse.json({ status: "ok", events, stuckOnboarding, cronJobs, setup });
}
