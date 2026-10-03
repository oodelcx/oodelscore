import { Types } from "mongoose";
import { Business } from "../models/Business";
import { Response } from "../models/Response";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { CxPulseScore } from "../models/CxPulseScore";
import type { BillingOwnerType } from "../models/BillingSubscription";
import type { CxGoalMetric } from "../models/CxGoal";
import { hasProduct, type Product } from "../models/products";

const PROGRESS_WINDOW_DAYS = 30;

async function resolveBusinessIds(ownerType: BillingOwnerType, ownerId: Types.ObjectId, product: Product): Promise<Types.ObjectId[]> {
  if (ownerType === "business") return [ownerId];
  const businesses = await Business.find({ parentOrgId: ownerId }).select("_id enabledProducts");
  const scoped = product === "customer_experience" ? businesses : businesses.filter((b) => hasProduct(b, product));
  return scoped.map((b) => b._id);
}

/**
 * The three headline signals shown together everywhere (Analytics, Command
 * Center, CX Pulse), per the CSAT/CES gap fix:
 *  - NPS (nps_0_10): unchanged, its own metric, never blended with stars —
 *    this is bug #1 from the spec (the NPS/star score-blending bug).
 *  - CSAT: formalized here as top-2-box (% of star_1_5 answers that are 4
 *    or 5) — the star_1_5 question already IS the satisfaction question in
 *    every template; this just reports it the standard CSAT way alongside
 *    the raw average, instead of leaving CSAT invisible.
 *  - CES (ces_1_5): a NEW question type. Inverted scale — 1 is the good
 *    answer ("very easy"), so cesLowEffortPercent (% answering 1 or 2) is
 *    the headline number, the same "good outcome %" shape as CSAT's top-box,
 *    not a raw average that would read backwards next to star/NPS.
 * Each metric also returns its own sample size so callers can show a
 * low-confidence flag (see compare-client.tsx's LOW_SAMPLE_THRESHOLD
 * convention) without a second query.
 */
export async function computeStarAndNps(businessIds: Types.ObjectId[], from: Date, to: Date, product: Product = "customer_experience") {
  const responses = await Response.find({ businessId: { $in: businessIds }, product, submittedAt: { $gte: from, $lte: to } }).select("answers").lean();
  let starSum = 0;
  let starCount = 0;
  let csatSatisfiedCount = 0;
  const npsAnswers: number[] = [];
  let cesSum = 0;
  let cesCount = 0;
  let cesLowEffortCount = 0;
  for (const r of responses) {
    for (const a of r.answers) {
      if (a.type === "star_1_5" && typeof a.value === "number") {
        starSum += a.value;
        starCount += 1;
        if (a.value >= 4) csatSatisfiedCount += 1;
      } else if (a.type === "nps_0_10" && typeof a.value === "number") {
        npsAnswers.push(a.value);
      } else if (a.type === "ces_1_5" && typeof a.value === "number") {
        cesSum += a.value;
        cesCount += 1;
        if (a.value <= 2) cesLowEffortCount += 1;
      }
    }
  }
  const starAverage = starCount === 0 ? null : Math.round((starSum / starCount) * 100) / 100;
  const npsScore =
    npsAnswers.length === 0
      ? null
      : Math.round(((npsAnswers.filter((v) => v >= 9).length - npsAnswers.filter((v) => v <= 6).length) / npsAnswers.length) * 100);
  const csatPercent = starCount === 0 ? null : Math.round((csatSatisfiedCount / starCount) * 1000) / 10;
  const cesAverage = cesCount === 0 ? null : Math.round((cesSum / cesCount) * 100) / 100;
  const cesLowEffortPercent = cesCount === 0 ? null : Math.round((cesLowEffortCount / cesCount) * 1000) / 10;
  return {
    starAverage,
    npsScore,
    csatPercent,
    cesAverage,
    cesLowEffortPercent,
    starCount,
    npsCount: npsAnswers.length,
    cesCount,
  };
}

export async function computeCategoryAverage(
  businessIds: Types.ObjectId[],
  categoryId: Types.ObjectId,
  from: Date,
  to: Date,
  product: Product = "customer_experience"
): Promise<number | null> {
  const responses = await Response.find({ businessId: { $in: businessIds }, product, submittedAt: { $gte: from, $lte: to } }).select("answers").lean();
  let sum = 0;
  let count = 0;
  for (const r of responses) {
    for (const a of r.answers) {
      if (a.type === "star_1_5" && typeof a.value === "number" && a.categoryId?.toString() === categoryId.toString()) {
        sum += a.value;
        count += 1;
      }
    }
  }
  return count === 0 ? null : Math.round((sum / count) * 100) / 100;
}

async function computeOverdueActionsCount(ownerType: BillingOwnerType, ownerId: Types.ObjectId, product: Product): Promise<number> {
  const filter = ownerType === "business" ? { businessId: ownerId } : { parentOrgId: ownerId };
  return ActionBoardItem.countDocuments({ ...filter, product, status: { $ne: "resolved" }, dueDate: { $lt: new Date() } });
}

export interface GoalMetricRef {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  metric: CxGoalMetric;
  categoryId: Types.ObjectId | null;
  product: Product;
}

/** The same metric a goal targets, computed fresh — used both for a goal's live "current value" and to snapshot `startValue` at creation. */
export async function computeCurrentMetricValue(goal: GoalMetricRef, now: Date = new Date()): Promise<number | null> {
  if (goal.metric === "cxPulseLevel") {
    const score = await CxPulseScore.findOne({ ownerType: goal.ownerType, ownerId: goal.ownerId, product: goal.product }).sort({ period: -1 });
    return score?.level ?? null;
  }
  if (goal.metric === "overdueActionsCount") {
    return computeOverdueActionsCount(goal.ownerType, goal.ownerId, goal.product);
  }

  const businessIds = await resolveBusinessIds(goal.ownerType, goal.ownerId, goal.product);
  if (businessIds.length === 0) return null;
  const from = new Date(now.getTime() - PROGRESS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  if (goal.metric === "starAverage") return (await computeStarAndNps(businessIds, from, now, goal.product)).starAverage;
  if (goal.metric === "nps") return (await computeStarAndNps(businessIds, from, now, goal.product)).npsScore;
  if (goal.metric === "categoryAverage") {
    if (!goal.categoryId) return null;
    return computeCategoryAverage(businessIds, goal.categoryId, from, now, goal.product);
  }
  return null;
}

export interface GoalProgress {
  currentValue: number | null;
  progressPercent: number | null; // 0-100+, null when there isn't enough data yet
  onTrack: boolean | null; // null when there isn't enough data to judge pacing
  daysRemaining: number;
}

/**
 * `overdueActionsCount` is the one metric on this list where lower is
 * better ("reduce unresolved feedback by 50%"); every other metric is
 * higher-is-better. Progress and pacing both need to know which direction
 * counts as improvement.
 */
export function computeGoalProgress(
  metric: CxGoalMetric,
  startValue: number | null,
  targetValue: number,
  targetDate: Date,
  startedAt: Date,
  currentValue: number | null,
  now: Date = new Date()
): GoalProgress {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / DAY_MS);

  if (currentValue === null || startValue === null) {
    return { currentValue, progressPercent: null, onTrack: null, daysRemaining };
  }

  const lowerIsBetter = metric === "overdueActionsCount";
  const totalDelta = lowerIsBetter ? startValue - targetValue : targetValue - startValue;
  const currentDelta = lowerIsBetter ? startValue - currentValue : currentValue - startValue;
  const achieved = lowerIsBetter ? currentValue <= targetValue : currentValue >= targetValue;

  const progressPercent = totalDelta === 0 ? (achieved ? 100 : 0) : Math.round((currentDelta / totalDelta) * 100);

  let onTrack: boolean | null;
  if (achieved) {
    onTrack = true;
  } else if (daysRemaining <= 0) {
    onTrack = false;
  } else {
    const totalDays = Math.max((targetDate.getTime() - startedAt.getTime()) / DAY_MS, 1);
    const elapsedDays = Math.max((now.getTime() - startedAt.getTime()) / DAY_MS, 0);
    const expectedPercent = Math.min((elapsedDays / totalDays) * 100, 100);
    onTrack = progressPercent >= expectedPercent - 10; // 10pt grace band — pacing, not a hard cutoff
  }

  return { currentValue, progressPercent, onTrack, daysRemaining };
}
