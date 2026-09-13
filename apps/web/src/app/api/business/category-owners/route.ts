import { NextResponse } from "next/server";
import { connectToDatabase, Category, CategoryOwnerMapping, getCategoriesInUseForBusiness } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/** Feeds AI-assisted Action Board triage (spec Section 16): the AI picks
 * the category, this mapping says who the item should go to. Only shows
 * categories actually in use on this business's real survey — the full
 * platform-wide category list would include plenty that don't apply here
 * (a restaurant's categories showing up for a bank branch, etc.). */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [inUseIds, mappings] = await Promise.all([
    getCategoriesInUseForBusiness(session.business._id),
    CategoryOwnerMapping.find({ ownerScope: "business", ownerScopeId: session.business._id }),
  ]);
  const categories = inUseIds.size
    ? await Category.find({ _id: { $in: [...inUseIds] } }).sort({ name: 1 })
    : [];

  return NextResponse.json({ status: "ok", categories, mappings });
}

export async function PUT(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const defaultOwnerId = typeof body?.defaultOwnerId === "string" ? body.defaultOwnerId : "";
  if (!categoryId || !defaultOwnerId) {
    return NextResponse.json({ status: "error", message: "categoryId and defaultOwnerId are required" }, { status: 400 });
  }

  await connectToDatabase();
  const mapping = await CategoryOwnerMapping.findOneAndUpdate(
    { ownerScope: "business", ownerScopeId: session.business._id, categoryId },
    { $set: { defaultOwnerId } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", mapping });
}
