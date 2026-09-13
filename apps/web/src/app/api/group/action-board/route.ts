import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, Playbook } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Product decision: Group is read-only oversight on branch Action Board
 * items — creating and assigning work items is the branch's job. Group can
 * view every item across its businesses, comment on one, and flag it as
 * escalated (see [id]/route.ts), but never create or edit one directly.
 */
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
