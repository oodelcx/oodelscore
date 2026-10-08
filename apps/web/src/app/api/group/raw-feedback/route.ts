import { NextResponse } from "next/server";
import { connectToDatabase, Business, Response, PRODUCTS, meetsAnonymityFloor, teamMemberCanAccess, type Product } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { computeResponseStats } from "@/lib/responseStats";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const PRODUCT_SET: readonly string[] = PRODUCTS;

export async function GET(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "rawFeedback" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  // Staff feedback goes only to the people the group chose: the owner, and team members with Colleague Pulse access.
  if (searchParams.get("product") === "colleague_experience" && session.isTeamMember && !teamMemberCanAccess(session.user, "exPulse")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
  const filter = searchParams.get("filter") === "negative" ? "negative" : "all";
  const productParam = searchParams.get("product");
  const product: Product = productParam && PRODUCT_SET.includes(productParam) ? (productParam as Product) : "customer_experience";
  const branchId = searchParams.get("businessId");
  const skip = (page - 1) * limit;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id name").sort({ name: 1 });
  const businessNameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));
  const businessIds = businesses.map((b) => b._id);

  // A specific branch must be one of this org's own — filtering by an
  // arbitrary id from the query string could otherwise leak another
  // account's feedback into this response.
  let scopedBusinessIds =
    branchId && businessIds.some((id) => id.toString() === branchId) ? businessIds.filter((id) => id.toString() === branchId) : businessIds;

  const match: Record<string, unknown> = { businessId: { $in: scopedBusinessIds }, product };
  // Staff feedback: every response reaches the group from the very first one. What stays hidden is WHICH branch
  // wrote it, until that branch has 5 responses, so nobody at a small branch can be picked out.
  const branchesWithEnough = new Set<string>();
  if (product === "colleague_experience") {
    const counts = await Response.aggregate([{ $match: { businessId: { $in: businessIds }, product } }, { $group: { _id: "$businessId", n: { $sum: 1 } } }]);
    for (const c of counts) if (meetsAnonymityFloor(c.n)) branchesWithEnough.add(String(c._id));
    // Filtering to one small branch would single its people out, so that filter is ignored until the branch has 5.
    if (scopedBusinessIds.length === 1 && !branchesWithEnough.has(scopedBusinessIds[0].toString())) {
      scopedBusinessIds = businessIds;
      match.businessId = { $in: scopedBusinessIds };
    }
  }
  if (filter === "negative") {
    match.answers = { $elemMatch: { type: "star_1_5", value: { $lte: 2 } } };
  }
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    const submittedAt: Record<string, Date> = {};
    if (from && !Number.isNaN(from.getTime())) submittedAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) submittedAt.$lte = to;
    match.submittedAt = submittedAt;
  }

  const [total, responses, stats] = await Promise.all([
    Response.countDocuments(match),
    Response.find(match).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
    computeResponseStats(match),
  ]);

  const enriched = responses.map((r) => {
    const hideBranch = product === "colleague_experience" && !branchesWithEnough.has(r.businessId.toString());
    const { businessId, ...rest } = r;
    return hideBranch
      ? { ...rest, businessId: "", businessName: "Branch hidden (fewer than 5 responses)" }
      : { ...rest, businessId, businessName: businessNameById.get(r.businessId.toString()) ?? "Unknown" };
  });

  return NextResponse.json({
    status: "ok",
    responses: enriched,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
    businesses:
      product === "colleague_experience"
        ? businesses.filter((b) => branchesWithEnough.has(b._id.toString())).map((b) => ({ _id: b._id.toString(), name: b.name }))
        : businesses.map((b) => ({ _id: b._id.toString(), name: b.name })),
  });
}
