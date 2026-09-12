import { NextResponse } from "next/server";
import { connectToDatabase, Category, CategoryOwnerMapping } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** Feeds AI-assisted Action Board triage (spec Section 16): the AI picks
 * the category, this mapping says who the item should go to. */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [categories, mappings] = await Promise.all([
    Category.find().sort({ name: 1 }),
    CategoryOwnerMapping.find({ ownerScope: "parentOrg", ownerScopeId: session.org._id }),
  ]);

  return NextResponse.json({ status: "ok", categories, mappings });
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

  await connectToDatabase();
  const mapping = await CategoryOwnerMapping.findOneAndUpdate(
    { ownerScope: "parentOrg", ownerScopeId: session.org._id, categoryId },
    { $set: { defaultOwnerId } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", mapping });
}

// Approximates the spec's single per-org "Auto-assign without
// confirmation" toggle by applying it across every mapping for this org
// at once, since the field lives per-mapping in the schema.
export async function PATCH(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (typeof body?.autoAssignWithoutConfirmation !== "boolean") {
    return NextResponse.json({ status: "error", message: "autoAssignWithoutConfirmation must be a boolean" }, { status: 400 });
  }

  await connectToDatabase();
  await CategoryOwnerMapping.updateMany(
    { ownerScope: "parentOrg", ownerScopeId: session.org._id },
    { $set: { autoAssignWithoutConfirmation: body.autoAssignWithoutConfirmation } }
  );

  return NextResponse.json({ status: "ok" });
}
