import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase, Response, FeedbackPoint } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { computeResponseStats } from "@/lib/responseStats";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * filter/sort are applied server-side (not just page/limit) so pagination
 * stays correct while a filter or sort is active — filtering only the
 * current page in the client would desync the page count and hide matches
 * that happen to fall outside the fetched slice.
 */
function buildMatch(businessId: unknown, filter: string | null): Record<string, unknown> {
  const match: Record<string, unknown> = { businessId };
  if (filter === "negative") {
    match.answers = { $elemMatch: { type: "star_1_5", value: { $lte: 2 } } };
  } else if (filter === "comment") {
    match.answers = { $elemMatch: { type: "open_text", value: { $regex: /\S/ } } };
  } else if (filter && filter !== "all" && mongoose.isValidObjectId(filter)) {
    match.feedbackPointId = new mongoose.Types.ObjectId(filter);
  }
  return match;
}

export async function GET(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "rawFeedback" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
  const filter = searchParams.get("filter");
  const sort = searchParams.get("sort") === "lowest" ? "lowest" : "newest";
  const skip = (page - 1) * limit;

  await connectToDatabase();
  const match = buildMatch(session.business._id, filter);

  const [total, rows, feedbackPoints, stats] = await Promise.all([
    Response.countDocuments(match),
    sort === "lowest"
      ? Response.aggregate([
          { $match: match },
          {
            $addFields: {
              _starSort: {
                $ifNull: [
                  {
                    $min: {
                      $map: {
                        input: { $filter: { input: "$answers", as: "a", cond: { $eq: ["$$a.type", "star_1_5"] } } },
                        as: "a",
                        in: "$$a.value",
                      },
                    },
                  },
                  999,
                ],
              },
            },
          },
          { $sort: { _starSort: 1, submittedAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ])
      : Response.find(match).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
    FeedbackPoint.find({ businessId: session.business._id }).select("_id name"),
    computeResponseStats(match),
  ]);

  const feedbackPointNameById = new Map(feedbackPoints.map((fp) => [fp._id.toString(), fp.name]));
  const enriched = rows.map((r) => {
    // Aggregate rows (sort=lowest) carry a computed _starSort field used only
    // for ordering — strip it so the response shape matches the find() path.
    const { _starSort, ...rest } = r as typeof r & { _starSort?: number };
    return {
      ...rest,
      feedbackPointName: feedbackPointNameById.get((r.feedbackPointId as mongoose.Types.ObjectId).toString()) ?? "Unknown",
    };
  });

  return NextResponse.json({
    status: "ok",
    responses: enriched,
    feedbackPoints: feedbackPoints.map((fp) => ({ _id: fp._id.toString(), name: fp.name })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  });
}
