import { NextResponse } from "next/server";
import { connectToDatabase, RecurringIssueFlag, Category, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * "Own" flags are this business's own repeated cases — actionable here
 * (can be converted into an Improvement Initiative from this business's
 * own portal). "Org" flags are cross-branch patterns the parent org has
 * flagged that happen to include this business — shown for visibility
 * only; only the org can convert one of those (see spec discussion: a
 * genuinely cross-branch pattern is the org's call, not any one branch's).
 */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "improvementInitiatives")) {
    return NextResponse.json({ status: "error", message: "Improvement Initiatives is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const [ownFlags, orgFlags] = await Promise.all([
    RecurringIssueFlag.find({ ownerScope: "business", ownerScopeId: session.business._id, status: "active" }).sort({
      lastCaseAt: -1,
    }),
    session.business.parentOrgId
      ? RecurringIssueFlag.find({
          ownerScope: "parentOrg",
          ownerScopeId: session.business.parentOrgId,
          status: "active",
          businessIds: session.business._id,
        }).sort({ lastCaseAt: -1 })
      : Promise.resolve([]),
  ]);

  const categoryIds = [...new Set([...ownFlags, ...orgFlags].map((f) => f.categoryId.toString()))];
  const categories = categoryIds.length ? await Category.find({ _id: { $in: categoryIds } }) : [];
  const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));

  const serialize = (flag: (typeof ownFlags)[number], actionable: boolean) => ({
    ...flag.toObject(),
    categoryName: categoryNameById.get(flag.categoryId.toString()) ?? "Uncategorized",
    actionable,
  });

  return NextResponse.json({
    status: "ok",
    flags: [...ownFlags.map((f) => serialize(f, true)), ...orgFlags.map((f) => serialize(f, false))],
  });
}
