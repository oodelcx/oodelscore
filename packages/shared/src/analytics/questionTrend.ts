import type { IResponse } from "../models/Response";
import type { QuestionType } from "../models/QuestionTemplate";

/**
 * Question types that carry a numeric value on a fixed scale — the only
 * ones a trend line means anything for. open_text/yes_no/multiple_choice/
 * multi_select/dropdown answers aren't a number that can be averaged.
 */
export const NUMERIC_QUESTION_TYPES: readonly QuestionType[] = ["star_1_5", "nps_0_10", "emoji_scale", "slider"];

/** The fixed scale each numeric question type is answered on (see the feedback form renderer). */
export const QUESTION_TYPE_SCALE: Record<string, { min: number; max: number }> = {
  star_1_5: { min: 0, max: 5 },
  nps_0_10: { min: 0, max: 10 },
  emoji_scale: { min: 1, max: 5 },
  slider: { min: 0, max: 10 },
};

export const TREND_PERIODS = ["today", "7d", "1m", "3m", "6m", "1y", "all"] as const;
export type TrendPeriod = (typeof TREND_PERIODS)[number];

/** How far back a period reaches, and what granularity its buckets use. */
export function resolvePeriodRange(period: TrendPeriod, now: Date = new Date()): { from: Date; granularity: "hour" | "day" } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "today":
      return { from: startOfToday, granularity: "hour" };
    case "7d":
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), granularity: "day" };
    case "1m":
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()), granularity: "day" };
    case "3m":
      return { from: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()), granularity: "day" };
    case "6m":
      return { from: new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()), granularity: "day" };
    case "1y":
      return { from: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()), granularity: "day" };
    case "all":
      return { from: new Date(0), granularity: "day" };
  }
}

export interface QuestionTrendPoint {
  bucket: string; // ISO date (day) or "YYYY-MM-DDTHH" (hour)
  average: number | null;
  count: number;
}

/**
 * Buckets one question's answers, across a set of already date-filtered
 * responses, into one average-per-bucket point — hourly for "today",
 * daily otherwise. Gaps (no answers in a bucket) stay null rather than
 * being interpolated, same convention as the existing star-rating trend.
 */
export function computeQuestionTrend(
  responses: Pick<IResponse, "answers" | "submittedAt">[],
  questionId: string,
  from: Date,
  to: Date,
  granularity: "hour" | "day"
): QuestionTrendPoint[] {
  const byBucket = new Map<string, { sum: number; count: number }>();
  const bucketKey = (d: Date) => (granularity === "hour" ? d.toISOString().slice(0, 13) : d.toISOString().slice(0, 10));

  for (const response of responses) {
    const answer = response.answers.find((a) => a.questionId?.toString() === questionId);
    if (!answer || typeof answer.value !== "number") continue;
    const key = bucketKey(response.submittedAt);
    const entry = byBucket.get(key) ?? { sum: 0, count: 0 };
    entry.sum += answer.value;
    entry.count += 1;
    byBucket.set(key, entry);
  }

  const points: QuestionTrendPoint[] = [];
  const stepMs = granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  for (let t = from.getTime(); t <= to.getTime(); t += stepMs) {
    const key = bucketKey(new Date(t));
    const entry = byBucket.get(key);
    points.push({
      bucket: key,
      average: entry ? Math.round((entry.sum / entry.count) * 100) / 100 : null,
      count: entry?.count ?? 0,
    });
  }
  return points;
}
