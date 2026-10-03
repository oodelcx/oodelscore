import { NextResponse } from "next/server";
import { connectToDatabase, SupportTicket } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/** Same gate as Audit Log/Platform Health — staff-internal, not a per-role CRUD key. */
export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.staffAndRoles.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const tickets = await SupportTicket.find(filter).sort({ createdAt: -1 }).limit(200);
  return NextResponse.json({ status: "ok", tickets });
}
