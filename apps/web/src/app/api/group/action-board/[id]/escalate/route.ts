import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, escalateActionBoardItem, EscalationError } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Lets the Group act as any level in the chain above the branch (Regional
 * Head, Unit Head, etc., whoever the org's escalationLevels configure) —
 * distinct from the existing read-only `escalated` flag, which only flags a
 * branch item for attention without moving it through the chain.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ allowLimitedTeamMember: true, requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const item = await ActionBoardItem.findOne({ _id: id, parentOrgId: session.org._id });
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
