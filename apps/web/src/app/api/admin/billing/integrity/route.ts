import { NextResponse } from "next/server";
import { connectToDatabase, findBillingIntegrityIssues } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/** Surfaces bug #4 (orphaned/misassigned billing rows) on the Billing Oversight page. */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const issues = await findBillingIntegrityIssues();
  return NextResponse.json({ status: "ok", issues });
}
