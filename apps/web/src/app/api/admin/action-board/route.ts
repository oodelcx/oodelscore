import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/** Admin gets "view (oversight)" only per spec Section 4 — full CRUD is Parent Org-only. */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.parentOrgs.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const rows = await ActionBoardItem.find().sort({ createdAt: -1 }).limit(200);
  // Admin may see that a Sensitive case exists, never what it says.
  const items = rows.map((row) => {
    if (!row.sensitive) return row;
    const o = row.toObject();
    return { ...o, title: "Confidential concern", description: "", suggestedAction: "", resolutionNote: "", sourceResponseIds: [], escalationNote: "" };
  });
  return NextResponse.json({ status: "ok", items });
}
