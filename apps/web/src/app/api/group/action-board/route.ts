import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, Playbook } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";
import { buildCaseStats, attachPlaybookRunsToItems, ratingsForItems } from "@/lib/caseStats";

/**
 * Product decision: Group is read-only oversight on branch Action Board
 * items — creating and assigning work items is the branch's job. Group can
 * view every item across its businesses, comment on one, and flag it as
 * escalated (see [id]/route.ts), but never create or edit one directly.
 *
 * Scoped to the account's current product view (see resolveViewProduct) —
 * a dual-product account's Customer and Colleague tabs must show their own
 * cases, never one blended list.
 */
export async function GET() {
  const session = await requireParentOrgOwner({ allowLimitedTeamMember: true, requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const product = await resolveViewProduct(session.org);

  const filter: Record<string, unknown> = { parentOrgId: session.org._id, product };
  if (session.tier === "limited") filter.ownerId = session.user._id;

  const [items, playbooks] = await Promise.all([
    ActionBoardItem.find(filter).sort({ createdAt: -1 }),
    Playbook.find({ parentOrgId: session.org._id }),
  ]);

  const stats = buildCaseStats(items);
  const [itemsWithRuns, ratingByItemId] = await Promise.all([
    attachPlaybookRunsToItems(items, playbooks),
    ratingsForItems(items),
  ]);
  const itemsWithRatings = itemsWithRuns.map((item) => ({
    ...item,
    rating: ratingByItemId.get(String((item as unknown as { _id: unknown })._id)) ?? null,
  }));

  return NextResponse.json({ status: "ok", product, items: itemsWithRatings, playbooks, tier: session.tier, stats });
}
