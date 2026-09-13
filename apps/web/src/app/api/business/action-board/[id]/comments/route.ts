import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, ActionItemComment, User, sendTemplatedEmail } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

function authorLabel(user: { email: string; teamRole: string }): string {
  return user.teamRole ? `${user.email} (${user.teamRole})` : user.email;
}

/**
 * The running comment trail on an item — separate from the single closing
 * `resolutionNote`. Visible to anyone who can see the item at all (full
 * access, or the limited-tier assignee on their own item).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ allowLimitedTeamMember: true });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const item = await ActionBoardItem.findOne({ _id: id, businessId: session.business._id });
  if (!item) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (session.tier === "limited" && item.ownerId?.toString() !== session.user._id.toString()) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const comments = await ActionItemComment.find({ actionItemId: id }).sort({ createdAt: 1 });
  return NextResponse.json({ status: "ok", comments });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ allowLimitedTeamMember: true });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const item = await ActionBoardItem.findOne({ _id: id, businessId: session.business._id });
  if (!item) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (session.tier === "limited" && item.ownerId?.toString() !== session.user._id.toString()) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ status: "error", message: "Comment text is required" }, { status: 400 });

  const comment = await ActionItemComment.create({
    actionItemId: item._id,
    authorId: session.user._id,
    authorLabel: authorLabel(session.user),
    body: text,
  });

  if (item.ownerId && item.ownerId.toString() !== session.user._id.toString()) {
    const recipient = await User.findById(item.ownerId);
    if (recipient) {
      await sendTemplatedEmail("action_comment_added", recipient.email, {
        name: recipient.email,
        commenter_name: authorLabel(session.user),
        action_title: item.title,
        comment_body: text,
        action_link: `${process.env.APP_URL ?? ""}/business`,
      }).catch((err) => console.error("[action-board] failed to send action_comment_added", err));
    }
  }

  return NextResponse.json({ status: "ok", comment }, { status: 201 });
}
