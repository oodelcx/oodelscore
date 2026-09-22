import { NextResponse } from "next/server";
import { connectToDatabase, SystemHealthEvent, findStuckOnboardingAccounts } from "@oodelscore/shared";
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

  return NextResponse.json({ status: "ok", events, stuckOnboarding });
}
