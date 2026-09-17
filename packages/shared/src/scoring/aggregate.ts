import { Types } from "mongoose";
import { Response } from "../models/Response";
import { Category } from "../models/Category";

/**
 * Spec Section 2 / bug #1: star (1-5) and NPS (0-10) answers must never be
 * blended into one average. This is the single place that computes both,
 * so every consumer (Alert Rules, AI Insights, CX Pulse) gets it right.
 */
export interface BusinessMetrics {
  responseCount: number;
  starAverage: number | null; // null when there are no star_1_5 answers in range
  npsScore: number | null; // null when there are no nps_0_10 answers in range
}

export async function computeBusinessMetrics(
  businessId: Types.ObjectId | string,
  from: Date,
  to: Date
): Promise<BusinessMetrics> {
  const responses = await Response.find({
    businessId,
    submittedAt: { $gte: from, $lte: to },
  }).lean();

  let starSum = 0;
  let starCount = 0;
  const npsAnswers: number[] = [];

  for (const response of responses) {
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number") {
        starSum += answer.value;
        starCount += 1;
      } else if (answer.type === "nps_0_10" && typeof answer.value === "number") {
        npsAnswers.push(answer.value);
      }
    }
  }

  const npsScore =
    npsAnswers.length === 0
      ? null
      : (() => {
          const promoters = npsAnswers.filter((v) => v >= 9).length;
          const detractors = npsAnswers.filter((v) => v <= 6).length;
          return Math.round(((promoters - detractors) / npsAnswers.length) * 100);
        })();

  return {
    responseCount: responses.length,
    starAverage: starCount === 0 ? null : Math.round((starSum / starCount) * 100) / 100,
    npsScore,
  };
}

export interface CategoryBreakdownEntry {
  categoryId: string;
  name: string;
  average: number;
}

/**
 * Per-category star average for one business over a window — powers Compare
 * branches' "By category" grouped bars and the full comparison table (per
 * the mockup: "Where the real gaps are, not just the overall average.").
 * Only star_1_5 answers are aggregated, same rule as computeBusinessMetrics.
 */
export async function computeBusinessCategoryBreakdown(
  businessId: Types.ObjectId | string,
  from: Date,
  to: Date
): Promise<CategoryBreakdownEntry[]> {
  const [responses, categories] = await Promise.all([
    Response.find({ businessId, submittedAt: { $gte: from, $lte: to } }).select("answers").lean(),
    Category.find(),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));

  const totals = new Map<string, { sum: number; count: number }>();
  for (const response of responses) {
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number" && answer.categoryId) {
        const key = answer.categoryId.toString();
        const entry = totals.get(key) ?? { sum: 0, count: 0 };
        entry.sum += answer.value;
        entry.count += 1;
        totals.set(key, entry);
      }
    }
  }

  return Array.from(totals.entries())
    .map(([categoryId, { sum, count }]) => ({
      categoryId,
      name: categoryNameById.get(categoryId) ?? "Uncategorized",
      average: Math.round((sum / count) * 100) / 100,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
