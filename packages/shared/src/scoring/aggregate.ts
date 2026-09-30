import { Types } from "mongoose";
import { Response } from "../models/Response";
import { Category } from "../models/Category";
import { resolveCsatQuestionIds } from "../feedback/questionText";
import type { Product } from "../models/products";

/**
 * Spec Section 2 / bug #1: star (1-5) and NPS (0-10) answers must never be
 * blended into one average. This is the single place that computes all
 * three headline signals, so every consumer (Alert Rules, AI Insights, CX
 * Pulse, Analytics, Command Center) gets them right and consistently:
 *  - starAverage / npsScore: unchanged.
 *  - csatPercent: top-2-box % (4 or 5) from answers to whichever star_1_5
 *    question a business/Admin has marked as "the" CSAT question on its
 *    template (IQuestion.isCsatQuestion) — never blended across every
 *    star_1_5 question in the template, which would be the same shape of
 *    bug as the original NPS/star-blending issue this fixes, one level
 *    down. null until a template has a question marked this way.
 *  - cesAverage / cesLowEffortPercent: from the ces_1_5 question type.
 *    Inverted scale (1 = very easy = good), so cesLowEffortPercent (%
 *    answering 1 or 2) is the headline "good outcome %", the same shape as
 *    csatPercent — a raw average would read backwards next to star/NPS/CSAT.
 * Sample sizes (starCount/npsCount/cesCount) ride along so any caller can
 * show a low-confidence flag without a second query.
 */
export interface BusinessMetrics {
  responseCount: number;
  starAverage: number | null; // null when there are no star_1_5 answers in range
  npsScore: number | null; // null when there are no nps_0_10 answers in range
  csatPercent: number | null; // null when no template in range has a question marked isCsatQuestion
  cesAverage: number | null; // null when there are no ces_1_5 answers in range
  cesLowEffortPercent: number | null; // null when there are no ces_1_5 answers in range
  starCount: number;
  npsCount: number;
  csatCount: number; // answers to the CSAT-flagged question specifically — not the same as starCount, which is every star_1_5 answer
  cesCount: number;
}

export async function computeBusinessMetrics(
  businessId: Types.ObjectId | string,
  from: Date,
  to: Date,
  product: Product = "customer_experience"
): Promise<BusinessMetrics> {
  const responses = await Response.find({
    businessId,
    product,
    submittedAt: { $gte: from, $lte: to },
  }).lean();

  const csatQuestionIds = await resolveCsatQuestionIds(responses);

  let starSum = 0;
  let starCount = 0;
  let csatSatisfiedCount = 0;
  let csatAnsweredCount = 0;
  const npsAnswers: number[] = [];
  let cesSum = 0;
  let cesCount = 0;
  let cesLowEffortCount = 0;

  for (const response of responses) {
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number") {
        starSum += answer.value;
        starCount += 1;
        if (csatQuestionIds.has(answer.questionId.toString())) {
          csatAnsweredCount += 1;
          if (answer.value >= 4) csatSatisfiedCount += 1;
        }
      } else if (answer.type === "nps_0_10" && typeof answer.value === "number") {
        npsAnswers.push(answer.value);
      } else if (answer.type === "ces_1_5" && typeof answer.value === "number") {
        cesSum += answer.value;
        cesCount += 1;
        if (answer.value <= 2) cesLowEffortCount += 1;
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
    // null when no template involved has a CSAT question marked yet — never
    // fabricated by blending every star_1_5 question together (see
    // resolveCsatQuestionIds's own comment).
    csatPercent: csatAnsweredCount === 0 ? null : Math.round((csatSatisfiedCount / csatAnsweredCount) * 1000) / 10,
    cesAverage: cesCount === 0 ? null : Math.round((cesSum / cesCount) * 100) / 100,
    cesLowEffortPercent: cesCount === 0 ? null : Math.round((cesLowEffortCount / cesCount) * 1000) / 10,
    starCount,
    npsCount: npsAnswers.length,
    csatCount: csatAnsweredCount,
    cesCount,
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
  to: Date,
  product: Product = "customer_experience"
): Promise<CategoryBreakdownEntry[]> {
  const [responses, categories] = await Promise.all([
    Response.find({ businessId, product, submittedAt: { $gte: from, $lte: to } }).select("answers").lean(),
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
