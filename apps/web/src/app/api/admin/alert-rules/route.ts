import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Admin gets "view all (oversight)" only on Alert Rules per spec Section 4
 * — there is deliberately no POST/PATCH/DELETE here. Editing belongs to the
 * Business owner (their own rules) or Parent Org owner (own + cascade).
 */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.businesses.view && !session.role.permissions.parentOrgs.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const rules = await AlertRule.find().sort({ createdAt: -1 });
  return NextResponse.json({ status: "ok", rules });
}
