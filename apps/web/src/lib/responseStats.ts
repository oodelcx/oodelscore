import { Response } from "@oodelscore/shared";

export interface ResponseStats {
  total: number;
  avgStar: number | null;
  negative: number;
  flagged: number;
}

/**
 * Raw Feedback's KPI stat strip (Case Management has one, Raw Feedback
 * didn't) — computed over the *full* filtered result set via a real
 * aggregate query, not just the current page of 25 rows on screen, the same
 * way caseStats.ts's buildCaseStats keeps Case Management's stat strip
 * accurate regardless of pagination.
 */
export async function computeResponseStats(match: Record<string, unknown>): Promise<ResponseStats> {
  const [row] = await Response.aggregate([
    { $match: match },
    {
      $facet: {
        total: [{ $count: "count" }],
        star: [
          { $unwind: "$answers" },
          { $match: { "answers.type": "star_1_5" } },
          { $group: { _id: null, sum: { $sum: "$answers.value" }, count: { $sum: 1 } } },
        ],
        negative: [{ $match: { answers: { $elemMatch: { type: "star_1_5", value: { $lte: 2 } } } } }, { $count: "count" }],
        flagged: [{ $match: { flagged: true } }, { $count: "count" }],
      },
    },
  ]);

  const total = row?.total?.[0]?.count ?? 0;
  const starCount = row?.star?.[0]?.count ?? 0;
  const starSum = row?.star?.[0]?.sum ?? 0;
  const negative = row?.negative?.[0]?.count ?? 0;
  const flagged = row?.flagged?.[0]?.count ?? 0;

  return {
    total,
    avgStar: starCount === 0 ? null : Math.round((starSum / starCount) * 100) / 100,
    negative,
    flagged,
  };
}
