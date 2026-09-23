import { NextResponse } from "next/server";
import { connectToDatabase, seedDemoAccounts } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Ensures the four documented demo logins (one per account type: Admin,
 * Group, standalone Business, Business-as-branch — see demoAccounts.ts)
 * exist with working passwords. Idempotent, safe to re-run. Exists
 * because seedDemoAccounts() otherwise only runs via `npm run seed:demo`,
 * which needs a direct database connection an environment like staging
 * may not expose — this route gives Admin a way to (re)create them with
 * nothing but a browser. Same gating as ../seed-showcase.
 */
export async function POST() {
  if (process.env.ENABLE_DEV_DATA_TOOLS !== "true") {
    return NextResponse.json({ status: "error", message: "Dev Data Tools are not enabled in this environment" }, { status: 403 });
  }
  const session = await requireStaffSession();
  if (!session || session.role.name !== "Admin") {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const accounts = await seedDemoAccounts();
  return NextResponse.json({ status: "ok", accounts });
}
