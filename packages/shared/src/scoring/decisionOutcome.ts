import { Types } from "mongoose";
import { Business } from "../models/Business";
import type { DecisionOutcomeMetric } from "../models/DecisionLogEntry";
import { computeStarAndNps, computeCategoryAverage } from "./goals";

const BEFORE_WINDOW_DAYS = 30;
// Give a change time to show up in real feedback before calling it either
// way — an "after" window measured a day after implementation is noise, not
// a verdict.
const MIN_DAYS_AFTER = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DecisionOutcomeRef {
  businessId: Types.ObjectId | null;
  parentOrgId: Types.ObjectId | null;
  affectedBusinessIds: Types.ObjectId[];
  implementationDate: Date | null;
  outcomeMetric: DecisionOutcomeMetric | null;
  outcomeCategoryId: Types.ObjectId | null;
}

export interface DecisionOutcomeResult {
  outcomeBefore: number | null;
  outcomeAfter: number | null;
  // "not_ready": too soon after implementation to measure "after" yet.
  // "insufficient_data": missing prerequisites (no implementation date/metric,
  // or no responses in one of the windows) — never guess past this.
  verdict: "not_ready" | "positive" | "negative" | "no_change" | "insufficient_data";
  daysSinceImplementation: number | null;
}

/**
 * Closes the Listen -> Act -> Measure loop: given a logged decision with an
 * implementation date and a chosen metric, computes real before/after values
 * from actual response data instead of requiring someone to type two numbers
 * in by hand. Pure computation — no AI call.
 */
export async function computeDecisionOutcome(entry: DecisionOutcomeRef, now: Date = new Date()): Promise<DecisionOutcomeResult> {
  if (!entry.implementationDate || !entry.outcomeMetric) {
    return { outcomeBefore: null, outcomeAfter: null, verdict: "insufficient_data", daysSinceImplementation: null };
  }
  if (entry.outcomeMetric === "categoryAverage" && !entry.outcomeCategoryId) {
    return { outcomeBefore: null, outcomeAfter: null, verdict: "insufficient_data", daysSinceImplementation: null };
  }

  let businessIds: Types.ObjectId[];
  if (entry.affectedBusinessIds.length > 0) businessIds = entry.affectedBusinessIds;
  else if (entry.businessId) businessIds = [entry.businessId];
  else if (entry.parentOrgId) businessIds = (await Business.find({ parentOrgId: entry.parentOrgId }).select("_id")).map((b) => b._id);
  else businessIds = [];

  if (businessIds.length === 0) {
    return { outcomeBefore: null, outcomeAfter: null, verdict: "insufficient_data", daysSinceImplementation: null };
  }

  async function metricValue(from: Date, to: Date): Promise<number | null> {
    if (entry.outcomeMetric === "starAverage") return (await computeStarAndNps(businessIds, from, to)).starAverage;
    if (entry.outcomeMetric === "nps") return (await computeStarAndNps(businessIds, from, to)).npsScore;
    if (entry.outcomeMetric === "categoryAverage" && entry.outcomeCategoryId) {
      return computeCategoryAverage(businessIds, entry.outcomeCategoryId, from, to);
    }
    return null;
  }

  const implementationDate = entry.implementationDate;
  const beforeFrom = new Date(implementationDate.getTime() - BEFORE_WINDOW_DAYS * DAY_MS);
  const daysSinceImplementation = Math.floor((now.getTime() - implementationDate.getTime()) / DAY_MS);

  const outcomeBefore = await metricValue(beforeFrom, implementationDate);

  if (daysSinceImplementation < MIN_DAYS_AFTER) {
    return { outcomeBefore, outcomeAfter: null, verdict: "not_ready", daysSinceImplementation };
  }

  const outcomeAfter = await metricValue(implementationDate, now);

  if (outcomeBefore === null || outcomeAfter === null) {
    return { outcomeBefore, outcomeAfter, verdict: "insufficient_data", daysSinceImplementation };
  }

  // A small dead-zone so ordinary noise doesn't read as "improved" or "got worse".
  const deadZone = entry.outcomeMetric === "nps" ? 3 : 0.1;
  const delta = outcomeAfter - outcomeBefore;
  const verdict = delta > deadZone ? "positive" : delta < -deadZone ? "negative" : "no_change";

  return { outcomeBefore, outcomeAfter, verdict, daysSinceImplementation };
}
