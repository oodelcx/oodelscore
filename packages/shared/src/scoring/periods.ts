import { Types } from "mongoose";
import { Response } from "../models/Response";
import { computeBusinessMetrics } from "./aggregate";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PeriodComparison {
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  changePercent: number | null; // null when there's no prior-period data (spec Section 13 bug #5 guard)
}

async function computeWindow(businessIds: Types.ObjectId[], windowDays: number, now: Date): Promise<PeriodComparison> {
  const currentFrom = new Date(now.getTime() - windowDays * DAY_MS);
  const previousFrom = new Date(now.getTime() - windowDays * 2 * DAY_MS);

  const [current, previous] = await Promise.all([
    aggregateAcrossBusinesses(businessIds, currentFrom, now),
    aggregateAcrossBusinesses(businessIds, previousFrom, currentFrom),
  ]);

  const changePercent =
    previous.responseCount === 0 || previous.starAverage === null || current.starAverage === null
      ? null
      : Math.round(((current.starAverage - previous.starAverage) / previous.starAverage) * 1000) / 10;

  return { ...current, changePercent };
}

async function aggregateAcrossBusinesses(businessIds: Types.ObjectId[], from: Date, to: Date) {
  if (businessIds.length === 1) return computeBusinessMetrics(businessIds[0], from, to);

  const results = await Promise.all(businessIds.map((id) => computeBusinessMetrics(id, from, to)));
  const responseCount = results.reduce((sum, r) => sum + r.responseCount, 0);
  const starResults = results.filter((r) => r.starAverage !== null);
  const npsResults = results.filter((r) => r.npsScore !== null);
  return {
    responseCount,
    starAverage: starResults.length === 0 ? null : starResults.reduce((s, r) => s + (r.starAverage as number), 0) / starResults.length,
    npsScore: npsResults.length === 0 ? null : Math.round(npsResults.reduce((s, r) => s + (r.npsScore as number), 0) / npsResults.length),
  };
}

/** Powers the "This week / month / quarter / year" comparison cards. */
export async function computePeriodComparisons(businessIds: Types.ObjectId[], now: Date = new Date()) {
  const [week, month, quarter, year] = await Promise.all([
    computeWindow(businessIds, 7, now),
    computeWindow(businessIds, 30, now),
    computeWindow(businessIds, 90, now),
    computeWindow(businessIds, 365, now),
  ]);
  return { week, month, quarter, year };
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  starAverage: number | null;
}

/** Daily star average over the trailing `days` days — for the trend line chart. */
export async function computeDailyTrend(businessIds: Types.ObjectId[], days: number, now: Date = new Date()): Promise<TrendPoint[]> {
  const from = new Date(now.getTime() - days * DAY_MS);
  const responses = await Response.find({ businessId: { $in: businessIds }, submittedAt: { $gte: from } }).select("answers submittedAt");

  const byDay = new Map<string, { sum: number; count: number }>();
  for (const response of responses) {
    const day = response.submittedAt.toISOString().slice(0, 10);
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number") {
        const bucket = byDay.get(day) ?? { sum: 0, count: 0 };
        bucket.sum += answer.value;
        bucket.count += 1;
        byDay.set(day, bucket);
      }
    }
  }

  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10);
    const bucket = byDay.get(date);
    points.push({ date, starAverage: bucket ? Math.round((bucket.sum / bucket.count) * 100) / 100 : null });
  }
  return points;
}

export interface RatingDistribution {
  highCount: number; // 4-5 stars
  midCount: number; // 3 stars
  lowCount: number; // 1-2 stars
  highPercent: number;
  midPercent: number;
  lowPercent: number;
}

export async function computeRatingDistribution(businessIds: Types.ObjectId[], from: Date, to: Date): Promise<RatingDistribution> {
  const responses = await Response.find({ businessId: { $in: businessIds }, submittedAt: { $gte: from, $lte: to } }).select("answers");
  let high = 0;
  let mid = 0;
  let low = 0;
  for (const response of responses) {
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number") {
        if (answer.value >= 4) high++;
        else if (answer.value === 3) mid++;
        else low++;
      }
    }
  }
  const total = high + mid + low;
  return {
    highCount: high,
    midCount: mid,
    lowCount: low,
    highPercent: total === 0 ? 0 : Math.round((high / total) * 100),
    midPercent: total === 0 ? 0 : Math.round((mid / total) * 100),
    lowPercent: total === 0 ? 0 : Math.round((low / total) * 100),
  };
}
