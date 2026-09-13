import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, Business, Playbook, User, sendTemplatedEmail, ACTION_PRIORITIES } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireParentOrgOwner({ allowLimitedTeamMember: true });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const filter: Record<string, unknown> = { parentOrgId: session.org._id };
  if (session.tier === "limited") filter.ownerId = session.user._id;

  const [items, playbooks] = await Promise.all([
    ActionBoardItem.find(filter).sort({ createdAt: -1 }),
    Playbook.find({ parentOrgId: session.org._id }),
  ]);
  return NextResponse.json({ status: "ok", items, playbooks, tier: session.tier });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const businessId = typeof body?.businessId === "string" ? body.businessId : null;
  if (!title || !businessId) {
    return NextResponse.json({ status: "error", message: "title and businessId are required" }, { status: 400 });
  }

  const business = await Business.findOne({ _id: businessId, parentOrgId: session.org._id });
  if (!business) {
    return NextResponse.json({ status: "error", message: "businessId must be a business under this organization" }, { status: 400 });
  }

  const priority = ACTION_PRIORITIES.includes(body?.priority) ? body.priority : "medium";

  const item = await ActionBoardItem.create({
    parentOrgId: session.org._id,
    title,
    description: typeof body?.description === "string" ? body.description : "",
    businessId,
    categoryId: typeof body?.categoryId === "string" ? body.categoryId : null,
    priority,
    ownerId: typeof body?.ownerId === "string" ? body.ownerId : null,
    dueDate: typeof body?.dueDate === "string" ? new Date(body.dueDate) : null,
    sourceResponseIds: Array.isArray(body?.sourceResponseIds) ? body.sourceResponseIds : [],
  });

  if (item.ownerId) {
    const owner = await User.findById(item.ownerId);
    if (owner) {
      await sendTemplatedEmail("action_assigned", owner.email, {
        name: owner.email,
        action_title: item.title,
        due_date: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : "no due date",
        action_link: `${process.env.APP_URL ?? ""}/group`,
      }).catch((err) => console.error("[action-board] failed to send action_assigned", err));
    }
  }

  return NextResponse.json({ status: "ok", item }, { status: 201 });
}
