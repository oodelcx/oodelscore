import { NextResponse } from "next/server";
import { connectToDatabase, SupportTicket, SUPPORT_TICKET_STATUSES } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const STATUS_SET: readonly string[] = SUPPORT_TICKET_STATUSES;

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.staffAndRoles.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
  }
  if (body.status !== undefined && !STATUS_SET.includes(body.status)) {
    return NextResponse.json({ status: "error", message: "Invalid status" }, { status: 400 });
  }

  await connectToDatabase();
  const ticket = await SupportTicket.findById(id);
  if (!ticket) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  if (body.status !== undefined) {
    ticket.status = body.status;
    ticket.resolvedAt = body.status === "resolved" ? new Date() : null;
  }
  if (body.adminNote !== undefined) ticket.adminNote = String(body.adminNote);

  await ticket.save();
  return NextResponse.json({ status: "ok", ticket });
}
