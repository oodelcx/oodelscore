import { NextResponse } from "next/server";
import { connectToDatabase, RecurringIssueFlag, Category, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** Cross-branch recurring patterns for this org — see the business-side route for the split rationale. */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "improvementInitiatives")) {
    return NextResponse.json({ status: "error", message: "Improvement Initiatives is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const flags = await RecurringIssueFlag.find({
    ownerScope: "parentOrg",
    ownerScopeId: session.org._id,
    status: "active",
  }).sort({ lastCaseAt: -1 });

  const categoryIds = [...new Set(flags.map((f) => f.categoryId.toString()))];
  const categories = categoryIds.length ? await Category.find({ _id: { $in: categoryIds } }) : [];
  const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));

  return NextResponse.json({
    status: "ok",
    flags: flags.map((f) => ({
      ...f.toObject(),
      categoryName: categoryNameById.get(f.categoryId.toString()) ?? "Uncategorized",
      actionable: true,
    })),
  });
}
