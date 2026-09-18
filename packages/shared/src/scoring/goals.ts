import { Types } from "mongoose";
import { Business } from "../models/Business";
import { Response } from "../models/Response";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { CxPulseScore } from "../models/CxPulseScore";
import type { BillingOwnerType } from "../models/BillingSubscription";
import type { CxGoalMetric } from "../models/CxGoal";

const PROGRESS_WINDOW_DAYS = 30;

async function resolveBusinessIds(ownerType: BillingOwnerType, ownerId: Types.ObjectId): Promise<Types.ObjectId[]> {
  if (ownerType === "business") return [ownerId];
  const businesses = await Business.find({ parentOrgId: ownerId }).select("_id");
  return businesses.map((b) => b._id);
}

export async function computeStarAndNps(businessIds: Types.ObjectId[], from: Date, to: Date) {
  const responses = await Response.find({ businessId: { $in: businessIds }, submittedAt: { $gte: from, $lte: to } }).select("answers").lean();
  let starSum = 0;
  let starCount = 0;
  const npsAnswers: number[] = [];
  for (const r of responses) {
    for (const a of r.answers) {
      if (a.type === "star_1_5" && typeof a.value === "number") {
        starSum += a.value;
        starCount += 1;
      } else if (a.type === "nps_0_10" && typeof a.value === "number") {
        npsAnswers.push(a.value);
      }
    }
  }
  const starAverage = starCount === 0 ? null : Math.round((starSum / starCount) * 100) / 100;
  const npsScore =
    npsAnswers.length === 0
      ? null
      : Math.round(((npsAnswers.filter((v) => v >= 9).length - npsAnswers.filter((v) => v <= 6).length) / npsAnswers.length) * 100);
  return { starAverage, npsScore };
}

export async function computeCategoryAverage(businessIds: Types.ObjectId[], categoryId: Types.ObjectId, from: Date, to: Date): Promise<number | null> {
  const responses = await Response.find({ businessId: { $in: businessIds }, submittedAt: { $gte: from, $lte: to } }).select("answers").lean();
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

async function computeOverdueActionsCount(ownerType: BillingOwnerType, ownerId: Types.ObjectId): Promise<number> {
  const filter = ownerType === "business" ? { businessId: ownerId } : { parentOrgId: ownerId };
  return ActionBoardItem.countDocuments({ ...filter, status: { $ne: "resolved" }, dueDate: { $lt: new Date() } });
}

export interface GoalMetricRef {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  metric: CxGoalMetric;
  categoryId: Types.ObjectId | null;
}

/** The same metric a goal targets, computed fresh — used both for a goal's live "current value" and to snapshot `startValue` at creation. */
export async function computeCurrentMetricValue(goal: GoalMetricRef, now: Date = new Date()): Promise<number | null> {
  if (goal.metric === "cxPulseLevel") {
    const score = await CxPulseScore.findOne({ ownerType: goal.ownerType, ownerId: goal.ownerId }).sort({ period: -1 });
    return score?.level ?? null;
  }
  if (goal.metric === "overdueActionsCount") {
    return computeOverdueActionsCount(goal.ownerType, goal.ownerId);
  }

  const businessIds = await resolveBusinessIds(goal.ownerType, goal.ownerId);
  if (businessIds.length === 0) return null;
  const from = new Date(now.getTime() - PROGRESS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  if (goal.metric === "starAverage") return (await computeStarAndNps(businessIds, from, now)).starAverage;
  if (goal.metric === "nps") return (await computeStarAndNps(businessIds, from, now)).npsScore;
  if (goal.metric === "categoryAverage") {
    if (!goal.categoryId) return null;
    return computeCategoryAverage(businessIds, goal.categoryId, from, now);
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
