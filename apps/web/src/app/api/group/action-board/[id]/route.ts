import { NextResponse } from "next/server";
import {
  connectToDatabase,
  ActionBoardItem,
  User,
  Business,
  sendTemplatedEmail,
  ACTION_STATUSES,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Product decision: Group is read-only on branch Action Board items —
 * assignment/status/priority/due date is the branch's job, not the org's.
 * A "limited" tier team member is a different concern (someone actually
 * doing the work, keyed to items assigned to them) and keeps its existing
 * status/resolutionNote path. Everyone else at the Group level (the org
 * owner, or a "full" tier team member) can only toggle `escalated` and post
 * comments via the separate /comments route.
 *
 * Escalating notifies a real person: the item's assigned owner if it has
 * one, otherwise the branch's own owner login — there's no "higher up"
 * above the Group in this hierarchy, so escalating means "the org is
 * flagging this for the branch's attention now," not routing it upward.
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
    return NextResponse.json({ status: "ok", item });
  }

  if (typeof body?.escalated === "boolean") {
    item.escalated = body.escalated;
    item.escalatedAt = body.escalated ? new Date() : null;
    if (body.escalated && typeof body?.escalationNote === "string") item.escalationNote = body.escalationNote.trim();
    if (!body.escalated) item.escalationNote = "";
  }

  await item.save();

  if (body?.escalated === true) {
    const recipient = item.ownerId
      ? await User.findById(item.ownerId)
      : await User.findOne({ accountType: "business", parentId: item.businessId });
    const business = await Business.findById(item.businessId);
    if (recipient) {
      await sendTemplatedEmail("item_escalated", recipient.email, {
        name: recipient.email,
        escalator_name: session.user.email,
        org_name: session.org.name,
        business_name: business?.name ?? "your branch",
        action_title: item.title,
        escalation_note: item.escalationNote || "(no note added)",
        action_link: `${process.env.APP_URL ?? ""}/business/action-board`,
      }).catch((err) => console.error("[group-action-board] failed to send item_escalated", err));
    }
  }

  return NextResponse.json({ status: "ok", item });
}
