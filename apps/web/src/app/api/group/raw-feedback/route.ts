import { NextResponse } from "next/server";
import { connectToDatabase, Business, Response, PRODUCTS, meetsAnonymityFloor, type Product } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { computeResponseStats } from "@/lib/responseStats";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const PRODUCT_SET: readonly string[] = PRODUCTS;

export async function GET(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "rawFeedback" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
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
  const scopedBusinessIds =
    branchId && businessIds.some((id) => id.toString() === branchId) ? businessIds.filter((id) => id.toString() === branchId) : businessIds;

  const match: Record<string, unknown> = { businessId: { $in: scopedBusinessIds }, product };
  // Colleague Experience: withhold individual responses below the anonymity
  // floor and never list comments routed to the sensitive contact.
  if (product === "colleague_experience") {
    match.sensitiveRouted = { $ne: true };
    const totalForScope = await Response.countDocuments({ businessId: { $in: scopedBusinessIds }, product });
    if (!meetsAnonymityFloor(totalForScope)) {
      return NextResponse.json({ status: "ok", responses: [], feedbackPoints: [], page: 1, limit, total: 0, totalPages: 1, stats: null, belowAnonymityFloor: true });
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

  const enriched = responses.map((r) => ({ ...r, businessName: businessNameById.get(r.businessId.toString()) ?? "Unknown" }));

  return NextResponse.json({
    status: "ok",
    responses: enriched,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
    businesses: businesses.map((b) => ({ _id: b._id.toString(), name: b.name })),
  });
}
