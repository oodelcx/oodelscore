import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase, Category, CategoryOwnerMapping, getCategoriesInUseForBusiness, getEnabledProducts, hasProduct, getEscalationConfig } from "@oodelscore/shared";
import { requireBusinessOwner, checkBranchPermission } from "@/lib/ownerAuth";

/** Feeds AI-assisted Action Board triage (spec Section 16): the AI picks
 * the category, this mapping says who the item should go to. `categories`
 * only shows ones actually in use on this business's real survey — the
 * full platform-wide category list would include plenty that don't apply
 * here (a restaurant's categories showing up for a bank branch, etc.).
 * `allCategories` (product-scoped, not usage-filtered) is separate: the
 * survey builder needs the full pickable list, since a category a business
 * is about to tag its first question with is by definition not "in use"
 * yet. */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [inUseIds, mappings, allCategories, escalationConfig] = await Promise.all([
    getCategoriesInUseForBusiness(session.business._id),
    CategoryOwnerMapping.find({ ownerScope: "business", ownerScopeId: session.business._id }),
    Category.find({ product: { $in: getEnabledProducts(session.business) } }).sort({ name: 1 }).select("name product"),
    getEscalationConfig(session.business),
  ]);
  const categories = inUseIds.size
    ? await Category.find({ _id: { $in: [...inUseIds] } }).sort({ name: 1 })
    : [];

  return NextResponse.json({
    status: "ok",
    categories,
    allCategories,
    mappings,
    ceEnabled: hasProduct(session.business, "colleague_experience"),
    sensitiveRoutingContactId: session.business.sensitiveRoutingContactId,
    escalationLevels: escalationConfig.levels,
  });
}

/**
 * Sets the business's sensitive-category routing contact (see
 * Category.sensitive / Business.sensitiveRoutingContactId) — separate
 * from the per-category PUT below since this is one account-wide setting,
 * not a per-category mapping.
 */
export async function PATCH(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!("sensitiveRoutingContactId" in (body ?? {}))) {
    return NextResponse.json({ status: "error", message: "sensitiveRoutingContactId is required" }, { status: 400 });
  }
  const contactId = typeof body.sensitiveRoutingContactId === "string" ? new Types.ObjectId(body.sensitiveRoutingContactId) : null;

  await connectToDatabase();
  session.business.sensitiveRoutingContactId = contactId;
  await session.business.save();

  return NextResponse.json({ status: "ok" });
}

export async function PUT(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!(await checkBranchPermission(session.business, "categoryOwners"))) {
    return NextResponse.json({ status: "error", message: "Your parent organization manages Category Owners centrally" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const defaultOwnerId = typeof body?.defaultOwnerId === "string" ? body.defaultOwnerId : "";
  if (!categoryId || !defaultOwnerId) {
    return NextResponse.json({ status: "error", message: "categoryId and defaultOwnerId are required" }, { status: 400 });
  }
  const repeatThresholdCount =
    body?.repeatThresholdCount === null || typeof body?.repeatThresholdCount === "number" ? body.repeatThresholdCount : undefined;
  const repeatWindowDays =
    body?.repeatWindowDays === null || typeof body?.repeatWindowDays === "number" ? body.repeatWindowDays : undefined;
  const escalateAfterDays =
    body?.escalateAfterDays === null || typeof body?.escalateAfterDays === "number" ? body.escalateAfterDays : undefined;
  const escalateToLevel =
    body?.escalateToLevel === null || typeof body?.escalateToLevel === "number" ? body.escalateToLevel : undefined;

  await connectToDatabase();
  const mapping = await CategoryOwnerMapping.findOneAndUpdate(
    { ownerScope: "business", ownerScopeId: session.business._id, categoryId },
    {
      $set: {
        defaultOwnerId,
        ...(repeatThresholdCount !== undefined ? { repeatThresholdCount } : {}),
        ...(repeatWindowDays !== undefined ? { repeatWindowDays } : {}),
        ...(escalateAfterDays !== undefined ? { escalateAfterDays } : {}),
        ...(escalateToLevel !== undefined ? { escalateToLevel } : {}),
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", mapping });
}

export async function DELETE(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!(await checkBranchPermission(session.business, "categoryOwners"))) {
    return NextResponse.json({ status: "error", message: "Your parent organization manages Category Owners centrally" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") ?? "";
  if (!categoryId) {
    return NextResponse.json({ status: "error", message: "categoryId is required" }, { status: 400 });
  }

  await connectToDatabase();
  await CategoryOwnerMapping.deleteOne({ ownerScope: "business", ownerScopeId: session.business._id, categoryId });

  return NextResponse.json({ status: "ok" });
}
