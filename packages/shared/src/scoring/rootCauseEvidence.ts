import { Types } from "mongoose";
import { Response } from "../models/Response";
import { Category } from "../models/Category";
import { Business } from "../models/Business";
import { DecisionLogEntry } from "../models/DecisionLogEntry";
import { confidenceForSampleSize, type BenchmarkConfidence } from "./network";

const WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface HourConcentration {
  hourRange: string; // e.g. "12:00–14:00"
  count: number;
}

export interface BranchBreakdownEntry {
  businessId: string;
  name: string;
  currentAverage: number | null;
  confidence: BenchmarkConfidence;
}

export interface PriorDecisionEvidence {
  title: string;
  implementationDate: string;
  verdict: "positive" | "negative" | "no_change" | null;
}

/**
 * Every field here is a real, independently-checkable number or fact —
 * nothing in this bundle is inferred or narrated. Root Cause Analysis's
 * only job is to explain *this* evidence, never to add facts of its own;
 * this is what makes that possible.
 */
export interface RootCauseEvidence {
  categoryName: string;
  currentPeriodAverage: number | null;
  previousPeriodAverage: number | null;
  currentPeriodResponseCount: number;
  previousPeriodResponseCount: number;
  currentPeriodNegativeCount: number;
  previousPeriodNegativeCount: number;
  topHourConcentration: HourConcentration[];
  branchBreakdown: BranchBreakdownEntry[]; // only populated when businessIds.length > 1, lowest-scoring first
  priorDecision: PriorDecisionEvidence | null;
}

function windowedCategoryStats(
  responses: { answers: { type: string; value: unknown; categoryId: Types.ObjectId | null }[]; sentiment: string | null }[],
  categoryId: string
) {
  let sum = 0;
  let count = 0;
  let negativeCount = 0;
  for (const response of responses) {
    let hasCategory = false;
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number" && answer.categoryId?.toString() === categoryId) {
        sum += answer.value;
        count++;
        hasCategory = true;
      }
    }
    if (hasCategory && response.sentiment === "negative") negativeCount++;
  }
  return { average: count === 0 ? null : Math.round((sum / count) * 100) / 100, count, negativeCount };
}

/** Pure computation — gathers every fact Root Cause Analysis is allowed to reason about. No AI call. */
export async function gatherRootCauseEvidence(
  businessIds: (Types.ObjectId | string)[],
  categoryId: Types.ObjectId | string,
  now: Date = new Date()
): Promise<RootCauseEvidence> {
  const categoryIdStr = categoryId.toString();
  const category = await Category.findById(categoryId);
  const categoryName = category?.name ?? "Unknown category";

  const currentFrom = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const previousFrom = new Date(now.getTime() - WINDOW_DAYS * 2 * DAY_MS);

  const [currentResponses, previousResponses] = await Promise.all([
    Response.find({ businessId: { $in: businessIds }, submittedAt: { $gte: currentFrom, $lte: now } }).select(
      "answers sentiment submittedAt businessId"
    ),
    Response.find({ businessId: { $in: businessIds }, submittedAt: { $gte: previousFrom, $lte: currentFrom } }).select("answers sentiment"),
  ]);

  const current = windowedCategoryStats(currentResponses, categoryIdStr);
  const previous = windowedCategoryStats(previousResponses, categoryIdStr);

  // Time-of-day concentration: negative-sentiment responses that touched this category, bucketed into 2-hour windows.
  const hourBuckets = new Map<number, number>();
  for (const response of currentResponses) {
    if (response.sentiment !== "negative") continue;
    const touchesCategory = response.answers.some((a) => a.type === "star_1_5" && a.categoryId?.toString() === categoryIdStr);
    if (!touchesCategory) continue;
    const bucket = Math.floor(response.submittedAt.getHours() / 2) * 2;
    hourBuckets.set(bucket, (hourBuckets.get(bucket) ?? 0) + 1);
  }
  const topHourConcentration: HourConcentration[] = Array.from(hourBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([hour, count]) => ({ hourRange: `${String(hour).padStart(2, "0")}:00–${String(hour + 2).padStart(2, "0")}:00`, count }));

  // Per-branch breakdown, only meaningful when there's more than one branch to compare.
  let branchBreakdown: BranchBreakdownEntry[] = [];
  if (businessIds.length > 1) {
    const businesses = await Business.find({ _id: { $in: businessIds } }).select("name");
    const nameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));
    const byBusiness = new Map<string, typeof currentResponses>();
    for (const response of currentResponses) {
      const key = response.businessId.toString();
      const list = byBusiness.get(key) ?? [];
      list.push(response);
      byBusiness.set(key, list);
    }
    branchBreakdown = Array.from(byBusiness.entries())
      .map(([businessId, responses]) => {
        const stats = windowedCategoryStats(responses, categoryIdStr);
        return {
          businessId,
          name: nameById.get(businessId) ?? "Unknown branch",
          currentAverage: stats.average,
          confidence: confidenceForSampleSize(stats.count),
        };
      })
      .filter((b) => b.currentAverage !== null)
      .sort((a, b) => (a.currentAverage as number) - (b.currentAverage as number))
      .slice(0, 3);
  }

  // Recurrence check: has a decision already been logged and measured against this same category for these branches?
  const priorEntry = await DecisionLogEntry.findOne({
    $or: [{ businessId: { $in: businessIds } }, { affectedBusinessIds: { $in: businessIds } }],
    outcomeCategoryId: categoryId,
    outcomeMeasuredAt: { $ne: null },
  }).sort({ outcomeMeasuredAt: -1 });

  let priorDecision: PriorDecisionEvidence | null = null;
  if (priorEntry && priorEntry.implementationDate) {
    const deadZone = 0.1;
    const delta = (priorEntry.outcomeAfter ?? 0) - (priorEntry.outcomeBefore ?? 0);
    const verdict =
      priorEntry.outcomeBefore === null || priorEntry.outcomeAfter === null
        ? null
        : delta > deadZone
          ? "positive"
          : delta < -deadZone
            ? "negative"
            : "no_change";
    priorDecision = { title: priorEntry.title, implementationDate: priorEntry.implementationDate.toISOString(), verdict };
  }

  return {
    categoryName,
    currentPeriodAverage: current.average,
    previousPeriodAverage: previous.average,
    currentPeriodResponseCount: current.count,
    previousPeriodResponseCount: previous.count,
    currentPeriodNegativeCount: current.negativeCount,
    previousPeriodNegativeCount: previous.negativeCount,
    topHourConcentration,
    branchBreakdown,
    priorDecision,
  };
}
