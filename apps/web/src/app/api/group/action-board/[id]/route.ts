import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase, ActionBoardItem, User, sendTemplatedEmail, ACTION_PRIORITIES, ACTION_STATUSES } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/** Fires spec Section 11's action_assigned trigger whenever ownerId is set or changed. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const item = await ActionBoardItem.findOne({ _id: id, parentOrgId: session.org._id });
  if (!item) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const previousOwnerId = item.ownerId?.toString() ?? null;

  if (typeof body?.title === "string") item.title = body.title;
  if (typeof body?.description === "string") item.description = body.description;
  if (typeof body?.categoryId === "string") item.categoryId = new Types.ObjectId(body.categoryId);
  if (ACTION_PRIORITIES.includes(body?.priority)) item.priority = body.priority;
  if (ACTION_STATUSES.includes(body?.status)) item.status = body.status;
  if (body?.status === "resolved") {
    item.resolvedAt = new Date();
    if (typeof body?.resolutionNote === "string") item.resolutionNote = body.resolutionNote;
  }
  if (typeof body?.dueDate === "string") item.dueDate = new Date(body.dueDate);
  if ("ownerId" in (body ?? {})) {
    item.ownerId = typeof body.ownerId === "string" ? new Types.ObjectId(body.ownerId) : null;
  }

  await item.save();

  const newOwnerId = item.ownerId?.toString() ?? null;
  if (newOwnerId && newOwnerId !== previousOwnerId) {
    const owner = await User.findById(newOwnerId);
    if (owner) {
      await sendTemplatedEmail("action_assigned", owner.email, {
        name: owner.email,
        action_title: item.title,
        due_date: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : "no due date",
        action_link: `${process.env.APP_URL ?? ""}/group`,
      }).catch((err) => console.error("[action-board] failed to send action_assigned", err));
    }
  }

  return NextResponse.json({ status: "ok", item });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const removed = await ActionBoardItem.findOneAndDelete({ _id: id, parentOrgId: session.org._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
