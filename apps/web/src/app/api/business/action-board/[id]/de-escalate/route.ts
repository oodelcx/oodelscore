import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, deEscalateActionBoardItem, EscalationError } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/** Mirrors the escalate route — steps a case back down one configured level. */
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
    const updated = await deEscalateActionBoardItem(item, { note });
    return NextResponse.json({ status: "ok", item: updated });
  } catch (err) {
    if (err instanceof EscalationError) {
      return NextResponse.json({ status: "error", message: err.message }, { status: 400 });
    }
    throw err;
  }
}
