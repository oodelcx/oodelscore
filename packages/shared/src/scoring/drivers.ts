import { Types } from "mongoose";
import { Response } from "../models/Response";
import { Category } from "../models/Category";

/**
 * "What's driving our score" — correlates each category's star rating
 * against the *rest* of that same response's star answers (leave-one-out),
 * not the category's raw average against itself, which would just measure
 * autocorrelation. A category with a strong correlation and a below-average
 * score is a real lever to pull; a strong correlation with an above-average
 * score is a strength worth protecting.
 *
 * Pure computation, no AI involved — see the CX intelligence roadmap:
 * everything that can be answered with statistics on data we already have
 * should be, and only text analysis / root-cause narration should ever call
 * a model.
 */
export interface DriverResult {
  categoryId: string;
  name: string;
  categoryAverage: number;
  correlation: number | null; // Pearson r, -1..1; null when sample is too small to compute
  sampleSize: number;
  confidence: "reliable" | "low" | "insufficient";
  classification: "priority" | "strength" | "moderate";
}

const MIN_RELIABLE_SAMPLE = 15;
const MIN_LOW_CONFIDENCE_SAMPLE = 5;
const STRONG_CORRELATION = 0.3;

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return null;
  return numerator / Math.sqrt(denomX * denomY);
}

export async function computeDriverAnalysis(
  businessIds: (Types.ObjectId | string)[],
  from: Date,
  to: Date
): Promise<DriverResult[]> {
  if (businessIds.length === 0) return [];

  const [responses, categories] = await Promise.all([
    Response.find({ businessId: { $in: businessIds }, submittedAt: { $gte: from, $lte: to } }).select("answers"),
    Category.find(),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));

  interface ParsedResponse {
    totalSum: number;
    totalCount: number;
    byCategory: Map<string, { sum: number; count: number }>;
  }
  const parsed: ParsedResponse[] = [];
  const categoryOverallTotals = new Map<string, { sum: number; count: number }>();

  for (const response of responses) {
    let totalSum = 0;
    let totalCount = 0;
    const byCategory = new Map<string, { sum: number; count: number }>();
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number") {
        totalSum += answer.value;
        totalCount += 1;
        if (answer.categoryId) {
          const key = answer.categoryId.toString();
          const local = byCategory.get(key) ?? { sum: 0, count: 0 };
          local.sum += answer.value;
          local.count += 1;
          byCategory.set(key, local);
          const overall = categoryOverallTotals.get(key) ?? { sum: 0, count: 0 };
          overall.sum += answer.value;
          overall.count += 1;
          categoryOverallTotals.set(key, overall);
        }
      }
    }
    parsed.push({ totalSum, totalCount, byCategory });
  }

  const businessOverallSum = parsed.reduce((s, r) => s + r.totalSum, 0);
  const businessOverallCount = parsed.reduce((s, r) => s + r.totalCount, 0);
  const businessOverallAverage = businessOverallCount === 0 ? null : businessOverallSum / businessOverallCount;

  const results: DriverResult[] = [];
  for (const [categoryId, totals] of categoryOverallTotals.entries()) {
    const categoryAverage = Math.round((totals.sum / totals.count) * 100) / 100;

    const xs: number[] = [];
    const ys: number[] = [];
    for (const r of parsed) {
      const cat = r.byCategory.get(categoryId);
      if (!cat) continue;
      const remainingCount = r.totalCount - cat.count;
      if (remainingCount === 0) continue; // no other category on this response to compare against
      xs.push(cat.sum / cat.count);
      ys.push((r.totalSum - cat.sum) / remainingCount);
    }

    const sampleSize = xs.length;
    const correlation = sampleSize >= 3 ? pearson(xs, ys) : null;
    const confidence: DriverResult["confidence"] =
      sampleSize >= MIN_RELIABLE_SAMPLE ? "reliable" : sampleSize >= MIN_LOW_CONFIDENCE_SAMPLE ? "low" : "insufficient";

    let classification: DriverResult["classification"] = "moderate";
    if (confidence !== "insufficient" && correlation !== null && businessOverallAverage !== null) {
      const isStrong = Math.abs(correlation) >= STRONG_CORRELATION;
      if (isStrong && categoryAverage < businessOverallAverage - 0.05) classification = "priority";
      else if (isStrong && categoryAverage >= businessOverallAverage) classification = "strength";
    }

    results.push({
      categoryId,
      name: categoryNameById.get(categoryId) ?? "Uncategorized",
      categoryAverage,
      correlation: correlation === null ? null : Math.round(correlation * 100) / 100,
      sampleSize,
      confidence,
      classification,
    });
  }

  const classRank = (c: DriverResult["classification"]) => (c === "priority" ? 0 : c === "strength" ? 1 : 2);
  return results.sort((a, b) => {
    if (a.confidence === "insufficient" && b.confidence !== "insufficient") return 1;
    if (b.confidence === "insufficient" && a.confidence !== "insufficient") return -1;
    if (classRank(a.classification) !== classRank(b.classification)) return classRank(a.classification) - classRank(b.classification);
    return Math.abs(b.correlation ?? 0) - Math.abs(a.correlation ?? 0);
  });
}
