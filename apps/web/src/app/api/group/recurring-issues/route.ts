import { NextResponse } from "next/server";
import { connectToDatabase, RecurringIssueFlag, Category, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

/**
 * Cross-branch recurring patterns for this org — see the business-side route
 * for the split rationale.
 *
 * RecurringIssueFlag has no direct `product` field — it's scoped by
 * categoryId, and Category itself carries the product (see Category.ts). So
 * filtering to the account's current product view means resolving that
 * product's category ids first, then filtering flags to those.
 */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "improvementInitiatives")) {
    return NextResponse.json({ status: "error", message: "Improvement Initiatives is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const product = await resolveViewProduct(session.org);

  const productCategoryIds = (await Category.find({ product }).select("_id")).map((c) => c._id);

  const flags = await RecurringIssueFlag.find({
    ownerScope: "parentOrg",
    ownerScopeId: session.org._id,
    status: "active",
    categoryId: { $in: productCategoryIds },
  }).sort({ lastCaseAt: -1 });

  const categoryIds = [...new Set(flags.map((f) => f.categoryId.toString()))];
  const categories = categoryIds.length ? await Category.find({ _id: { $in: categoryIds } }) : [];
  const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));

  return NextResponse.json({
    status: "ok",
    product,
    flags: flags.map((f) => ({
      ...f.toObject(),
      categoryName: categoryNameById.get(f.categoryId.toString()) ?? "Uncategorized",
      actionable: true,
    })),
  });
}
