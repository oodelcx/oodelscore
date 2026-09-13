import { NextResponse } from "next/server";
import { type HydratedDocument } from "mongoose";
import {
  connectToDatabase,
  ActionBoardItem,
  DecisionLogEntry,
  ACTION_STATUSES,
  type IActionBoardItem,
} from "@oodelscore/shared";
import { requireParentOrgOwner, type ParentOrgOwnerSession } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Resolving with a note is how a decision gets recorded now — no separate
 * manual Decision Log entry step (product feedback: nobody thought to check
 * a separate page for it). One DecisionLogEntry per resolution, linked back
 * to the action item.
 */
async function logDecisionForResolution(
  item: HydratedDocument<IActionBoardItem>,
  session: ParentOrgOwnerSession,
  resolutionNote: string
) {
  await DecisionLogEntry.create({
    parentOrgId: session.org._id,
    businessId: null,
    title: item.title,
    trigger: resolutionNote,
    linkedActionIds: [item._id],
    affectedBusinessIds: [item.businessId],
    ownerId: item.ownerId,
    implementationDate: new Date(),
    status: "implemented",
  });
}

/**
 * Product decision: Group is read-only on branch Action Board items —
 * assignment/status/priority/due date is the branch's job, not the org's.
 * A "limited" tier team member is a different concern (someone actually
 * doing the work, keyed to items assigned to them) and keeps its existing
 * status/resolutionNote path. Everyone else at the Group level (the org
 * owner, or a "full" tier team member) can only toggle `escalated` — a
 * visibility flag, not an assignment change — and post comments via the
 * separate /comments route.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ allowLimitedTeamMember: true });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const item = await ActionBoardItem.findOne({ _id: id, parentOrgId: session.org._id });
  if (!item) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);

  if (session.tier === "limited") {
    if (item.ownerId?.toString() !== session.user._id.toString()) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }
    if (ACTION_STATUSES.includes(body?.status)) item.status = body.status;
    if (body?.status === "resolved") item.resolvedAt = new Date();
    if (typeof body?.resolutionNote === "string") item.resolutionNote = body.resolutionNote;
    await item.save();
    if (body?.status === "resolved" && typeof body?.resolutionNote === "string" && body.resolutionNote.trim()) {
      await logDecisionForResolution(item, session, body.resolutionNote.trim());
    }
    return NextResponse.json({ status: "ok", item });
  }

  if (typeof body?.escalated === "boolean") {
    item.escalated = body.escalated;
    item.escalatedAt = body.escalated ? new Date() : null;
  }

  await item.save();

  return NextResponse.json({ status: "ok", item });
}
