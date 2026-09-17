import { NextResponse } from "next/server";
import { connectToDatabase, Business, Response } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
  const filter = searchParams.get("filter") === "negative" ? "negative" : "all";
  const skip = (page - 1) * limit;

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id name");
  const businessNameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));

  const match: Record<string, unknown> = { businessId: { $in: businesses.map((b) => b._id) } };
  if (filter === "negative") {
    match.answers = { $elemMatch: { type: "star_1_5", value: { $lte: 2 } } };
  }

  const [total, responses] = await Promise.all([
    Response.countDocuments(match),
    Response.find(match).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const enriched = responses.map((r) => ({ ...r, businessName: businessNameById.get(r.businessId.toString()) ?? "Unknown" }));

  return NextResponse.json({
    status: "ok",
    responses: enriched,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
