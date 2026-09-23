import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, escalateActionBoardItem, EscalationError } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

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
  const item = await ActionBoardItem.findOne({ _id: id, businessId: session.business._id });
  if (!item) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  try {
    const updated = await escalateActionBoardItem(item, { note });
    return NextResponse.json({ status: "ok", item: updated });
  } catch (err) {
    if (err instanceof EscalationError) {
      return NextResponse.json({ status: "error", message: err.message }, { status: 400 });
    }
    throw err;
  }
}
