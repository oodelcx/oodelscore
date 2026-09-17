import { NextResponse } from "next/server";
import {
  connectToDatabase,
  ActionBoardItem,
  Playbook,
  User,
  sendTemplatedEmail,
  ACTION_PRIORITIES,
  autoAttachPlaybook,
} from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { buildCaseStats, attachPlaybookRunsToItems } from "@/lib/caseStats";

/**
 * Standalone business's own single-business Action Board (spec Section 16
 * correction — previously the Act layer was Group-only). A "limited" tier
 * Team Member only ever sees items assigned to them.
 */
export async function GET() {
  const session = await requireBusinessOwner({ allowLimitedTeamMember: true });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const filter: Record<string, unknown> = { businessId: session.business._id };
  if (session.tier === "limited") filter.ownerId = session.user._id;

  const scope = session.business.parentOrgId
    ? { parentOrgId: session.business.parentOrgId }
    : { businessId: session.business._id };

  const [items, playbooks] = await Promise.all([
    ActionBoardItem.find(filter).sort({ createdAt: -1 }),
    Playbook.find(scope),
  ]);

  const stats = buildCaseStats(items);
  const itemsWithRuns = await attachPlaybookRunsToItems(items, playbooks);

  return NextResponse.json({ status: "ok", items: itemsWithRuns, playbooks, tier: session.tier, stats });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const priority = ACTION_PRIORITIES.includes(body?.priority) ? body.priority : "medium";

  const item = await ActionBoardItem.create({
    parentOrgId: null,
    businessId: session.business._id,
    title,
    description: typeof body?.description === "string" ? body.description : "",
    categoryId: typeof body?.categoryId === "string" ? body.categoryId : null,
    priority,
    ownerId: typeof body?.ownerId === "string" ? body.ownerId : null,
    dueDate: typeof body?.dueDate === "string" ? new Date(body.dueDate) : null,
    sourceResponseIds: Array.isArray(body?.sourceResponseIds) ? body.sourceResponseIds : [],
    source: "manual",
  });

  await autoAttachPlaybook(item).catch((err) => console.error("[action-board] auto-attach playbook failed", err));

  if (item.ownerId) {
    const owner = await User.findById(item.ownerId);
    if (owner) {
      await sendTemplatedEmail("action_assigned", owner.email, {
        name: owner.email,
        action_title: item.title,
        due_date: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : "no due date",
        action_link: `${process.env.APP_URL ?? ""}/business`,
      }).catch((err) => console.error("[action-board] failed to send action_assigned", err));
    }
  }

  return NextResponse.json({ status: "ok", item }, { status: 201 });
}
