import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase, Category, CategoryOwnerMapping, getCategoriesInUseForParentOrg, getEnabledProducts } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** Feeds AI-assisted Action Board triage (spec Section 16): the AI picks
 * the category, this mapping says who the item should go to. `categories`
 * only shows ones actually in use across the org's branches' real surveys.
 * `allCategories` (product-scoped, not usage-filtered) is for the survey
 * builder, which needs the full pickable list — see the identical comment
 * on the business route. */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [inUseIds, mappings, allCategories] = await Promise.all([
    getCategoriesInUseForParentOrg(session.org._id),
    CategoryOwnerMapping.find({ ownerScope: "parentOrg", ownerScopeId: session.org._id }),
    Category.find({ product: { $in: getEnabledProducts(session.org) } }).sort({ name: 1 }).select("name product"),
  ]);
  const categories = inUseIds.size
    ? await Category.find({ _id: { $in: [...inUseIds] } }).sort({ name: 1 })
    : [];

  return NextResponse.json({
    status: "ok",
    categories,
    allCategories,
    mappings,
    escalationLevels: session.org.escalationLevels,
    sensitiveRoutingContactId: session.org.sensitiveRoutingContactId ? session.org.sensitiveRoutingContactId.toString() : null,
    colleagueEnabled: getEnabledProducts(session.org).includes("colleague_experience"),
  });
}

/**
 * Group-wide sensitive-category contact (Colleague Experience): used for any
 * branch that has not set its own, so a complaint about HR or leadership never
 * lands with the people it is about.
 */
export async function PATCH(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !("sensitiveRoutingContactId" in body)) {
    return NextResponse.json({ status: "error", message: "sensitiveRoutingContactId is required" }, { status: 400 });
  }
  await connectToDatabase();
  let contactId: Types.ObjectId | null = null;
  if (typeof body.sensitiveRoutingContactId === "string" && body.sensitiveRoutingContactId) {
    if (!Types.ObjectId.isValid(body.sensitiveRoutingContactId)) {
      return NextResponse.json({ status: "error", message: "Invalid contact" }, { status: 400 });
    }
    contactId = new Types.ObjectId(body.sensitiveRoutingContactId);
  }
  session.org.sensitiveRoutingContactId = contactId;
  await session.org.save();
  return NextResponse.json({ status: "ok" });
}

export async function PUT(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const defaultOwnerId = typeof body?.defaultOwnerId === "string" ? body.defaultOwnerId : "";
  if (!categoryId || !defaultOwnerId) {
    return NextResponse.json({ status: "error", message: "categoryId and defaultOwnerId are required" }, { status: 400 });
  }
  // Repeat detection ("flag this category as a recurring issue after N
  // cases in X days") is optional and off unless both are set — either can
  // be sent as null to turn it back off.
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
    { ownerScope: "parentOrg", ownerScopeId: session.org._id, categoryId },
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
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") ?? "";
  if (!categoryId) {
    return NextResponse.json({ status: "error", message: "categoryId is required" }, { status: 400 });
  }

  await connectToDatabase();
  await CategoryOwnerMapping.deleteOne({ ownerScope: "parentOrg", ownerScopeId: session.org._id, categoryId });

  return NextResponse.json({ status: "ok" });
}
