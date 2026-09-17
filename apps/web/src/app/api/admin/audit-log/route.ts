import { NextResponse } from "next/server";
import { connectToDatabase, AuditLogEntry } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/** Searchable trail for the sensitive writes logAuditEvent is called on
 * (permission changes, staff access, billing overrides, 2FA, access tier
 * changes) — not every mutation in the app. Filters: q (actor email or
 * action substring), action (exact), limit. */
export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.staffAndRoles.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const action = searchParams.get("action")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit")) || 50), 200);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (action) filter.action = action;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ actorEmail: re }, { action: re }, { targetLabel: re }];
  }

  const [total, entries, actions] = await Promise.all([
    AuditLogEntry.countDocuments(filter),
    AuditLogEntry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLogEntry.distinct("action"),
  ]);

  return NextResponse.json({
    status: "ok",
    entries,
    actions,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
