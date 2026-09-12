import { NextResponse } from "next/server";
import { connectToDatabase, DecisionLogEntry } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/** Admin gets "view (oversight)" only per spec Section 4 — full CRUD is Parent Org-only. */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.parentOrgs.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const entries = await DecisionLogEntry.find().sort({ createdAt: -1 }).limit(200);
  return NextResponse.json({ status: "ok", entries });
}
