import { NextResponse } from "next/server";
import { canViewCase } from "@oodelscore/shared";
import { connectToDatabase, ActionBoardItem, escalateActionBoardItem, EscalationError } from "@oodelscore/shared";
import { requireBusinessOwner, caseViewerForBusiness } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * The configurable-chain escalation, separate from the existing
 * escalated/escalatedToOrg flags (kept as-is for backward compatibility) —
 * advances the case one level per the org's configured escalation levels,
 * reassigns it to whoever holds that level, and records the move in the
 * case's escalationHistory.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ allowLimitedTeamMember: true, requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const viewer = caseViewerForBusiness(session);
  const item = await ActionBoardItem.findOne({ _id: id, businessId: session.business._id });
  if (!item || !canViewCase(item, viewer)) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  // A Sensitive case stays with its confidential contact; moving it up or down a chain could hand it to the person it concerns.
  if (item.sensitive) {
    return NextResponse.json({ status: "error", message: "A sensitive case is handled by its confidential contact and cannot be escalated or de-escalated." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  try {
    const updated = await escalateActionBoardItem(item, { note, byUserId: session.user._id });
    return NextResponse.json({ status: "ok", item: updated });
  } catch (err) {
    if (err instanceof EscalationError) {
      return NextResponse.json({ status: "error", message: err.message }, { status: 400 });
    }
    throw err;
  }
}
