import { Types } from "mongoose";
import { Business } from "../models/Business";
import { User } from "../models/User";
import { DecisionLogEntry, type DecisionOutcomeMetric } from "../models/DecisionLogEntry";
import { computeStarAndNps, computeCategoryAverage } from "./goals";
import { sendTemplatedEmail, resolveOwnerLoginEmail } from "../email/resend";

const METRIC_LABELS: Record<DecisionOutcomeMetric, string> = {
  starAverage: "Star average",
  nps: "NPS",
  categoryAverage: "Category average",
  csat: "CSAT",
  ces: "CES (low-effort %)",
};

// Same convention as compare-client.tsx's LOW_SAMPLE_THRESHOLD — a before
// or after window built from fewer than this many responses is flagged as
// low-confidence rather than shown as a bare verdict.
const LOW_SAMPLE_THRESHOLD = 10;

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
  // Response counts behind outcomeBefore/outcomeAfter, so a caller can flag
  // a verdict built from a handful of responses as low-confidence instead of
  // showing it with the same weight as one built from hundreds.
  sampleSizeBefore: number | null;
  sampleSizeAfter: number | null;
  lowConfidence: boolean;
}

/**
 * Closes the Listen -> Act -> Measure loop: given a logged decision with an
 * implementation date and a chosen metric, computes real before/after values
 * from actual response data instead of requiring someone to type two numbers
 * in by hand. Pure computation — no AI call.
 */
export async function computeDecisionOutcome(entry: DecisionOutcomeRef, now: Date = new Date()): Promise<DecisionOutcomeResult> {
  const empty: DecisionOutcomeResult = {
    outcomeBefore: null,
    outcomeAfter: null,
    verdict: "insufficient_data",
    daysSinceImplementation: null,
    sampleSizeBefore: null,
    sampleSizeAfter: null,
    lowConfidence: false,
  };

  if (!entry.implementationDate || !entry.outcomeMetric) return empty;
  if (entry.outcomeMetric === "categoryAverage" && !entry.outcomeCategoryId) return empty;

  let businessIds: Types.ObjectId[];
  if (entry.affectedBusinessIds.length > 0) businessIds = entry.affectedBusinessIds;
  else if (entry.businessId) businessIds = [entry.businessId];
  else if (entry.parentOrgId) businessIds = (await Business.find({ parentOrgId: entry.parentOrgId }).select("_id")).map((b) => b._id);
  else businessIds = [];

  if (businessIds.length === 0) return empty;

  async function metricValue(from: Date, to: Date): Promise<{ value: number | null; sampleSize: number }> {
    if (entry.outcomeMetric === "starAverage") {
      const m = await computeStarAndNps(businessIds, from, to);
      return { value: m.starAverage, sampleSize: m.starCount };
    }
    if (entry.outcomeMetric === "nps") {
      const m = await computeStarAndNps(businessIds, from, to);
      return { value: m.npsScore, sampleSize: m.npsCount };
    }
    if (entry.outcomeMetric === "csat") {
      const m = await computeStarAndNps(businessIds, from, to);
      return { value: m.csatPercent, sampleSize: m.starCount };
    }
    if (entry.outcomeMetric === "ces") {
      // Higher is better here too: cesLowEffortPercent is a "good outcome %"
      // (like CSAT's top-box), not the raw 1-5 effort average, so the same
      // delta > 0 = positive logic below applies unchanged.
      const m = await computeStarAndNps(businessIds, from, to);
      return { value: m.cesLowEffortPercent, sampleSize: m.cesCount };
    }
    if (entry.outcomeMetric === "categoryAverage" && entry.outcomeCategoryId) {
      const value = await computeCategoryAverage(businessIds, entry.outcomeCategoryId, from, to);
      return { value, sampleSize: value === null ? 0 : 1 }; // computeCategoryAverage doesn't expose a count; treat any real value as present
    }
    return { value: null, sampleSize: 0 };
  }

  const implementationDate = entry.implementationDate;
  const beforeFrom = new Date(implementationDate.getTime() - BEFORE_WINDOW_DAYS * DAY_MS);
  const daysSinceImplementation = Math.floor((now.getTime() - implementationDate.getTime()) / DAY_MS);

  const before = await metricValue(beforeFrom, implementationDate);

  if (daysSinceImplementation < MIN_DAYS_AFTER) {
    return {
      outcomeBefore: before.value,
      outcomeAfter: null,
      verdict: "not_ready",
      daysSinceImplementation,
      sampleSizeBefore: before.sampleSize,
      sampleSizeAfter: null,
      lowConfidence: before.value !== null && before.sampleSize < LOW_SAMPLE_THRESHOLD,
    };
  }

  const after = await metricValue(implementationDate, now);

  if (before.value === null || after.value === null) {
    return {
      outcomeBefore: before.value,
      outcomeAfter: after.value,
      verdict: "insufficient_data",
      daysSinceImplementation,
      sampleSizeBefore: before.sampleSize,
      sampleSizeAfter: after.sampleSize,
      lowConfidence: false,
    };
  }

  // A small dead-zone so ordinary noise doesn't read as "improved" or "got worse".
  const deadZone = entry.outcomeMetric === "nps" ? 3 : 0.1;
  const delta = after.value - before.value;
  const verdict = delta > deadZone ? "positive" : delta < -deadZone ? "negative" : "no_change";
  const lowConfidence = before.sampleSize < LOW_SAMPLE_THRESHOLD || after.sampleSize < LOW_SAMPLE_THRESHOLD;

  return {
    outcomeBefore: before.value,
    outcomeAfter: after.value,
    verdict,
    daysSinceImplementation,
    sampleSizeBefore: before.sampleSize,
    sampleSizeAfter: after.sampleSize,
    lowConfidence,
  };
}

/**
 * Resolves who should hear that a decision got a real verdict: the entry's
 * own `ownerId` if it has one (whoever is logged as responsible for it),
 * otherwise the same business/group owner login used for the Action Board
 * escalation email (see group/action-board/[id]/route.ts) — a decision
 * with no explicit owner still belongs to somebody's account.
 */
async function resolveDecisionRecipientEmail(entry: {
  ownerId: Types.ObjectId | null;
  businessId: Types.ObjectId | null;
  parentOrgId: Types.ObjectId | null;
}): Promise<string | null> {
  if (entry.ownerId) {
    const owner = await User.findById(entry.ownerId).select("email");
    if (owner) return owner.email;
  }
  if (entry.businessId) return resolveOwnerLoginEmail("business", entry.businessId);
  if (entry.parentOrgId) return resolveOwnerLoginEmail("parentOrg", entry.parentOrgId);
  return null;
}

/**
 * Closes the loop for real: an entry that just got a real verdict (not
 * not_ready/insufficient_data — same gate autoMeasurePendingDecisions
 * already applies before saving) emails whoever owns it, with the verdict
 * and the real before/after numbers, instead of only the number changing
 * silently in the Decision Log. Fire-and-forget with logging, same as every
 * other templated send in this codebase — a failed email must never break
 * the measurement itself.
 */
async function notifyDecisionOutcomeMeasured(
  entry: { title: string; ownerId: Types.ObjectId | null; businessId: Types.ObjectId | null; parentOrgId: Types.ObjectId | null },
  result: DecisionOutcomeResult,
  metric: DecisionOutcomeMetric
): Promise<void> {
  const recipient = await resolveDecisionRecipientEmail(entry);
  if (!recipient) return;

  const decisionLink = `${process.env.APP_URL ?? ""}${entry.parentOrgId && !entry.businessId ? "/group/decision-log" : "/business/decision-log"}`;

  await sendTemplatedEmail("decision_outcome_measured", recipient, {
    name: recipient,
    decision_title: entry.title,
    verdict: result.verdict.replace(/_/g, " "),
    metric_label: METRIC_LABELS[metric],
    outcome_before: result.outcomeBefore !== null ? String(result.outcomeBefore) : "—",
    outcome_after: result.outcomeAfter !== null ? String(result.outcomeAfter) : "—",
    decision_link: decisionLink,
  }).catch((err) => console.error("[decision-outcome] failed to send decision_outcome_measured", err));
}

/**
 * Sweeps every decision that has a metric + implementation date but hasn't
 * been measured yet, and measures the ones that have crossed the 14-day
 * MIN_DAYS_AFTER mark — the same computation the manual "Auto-measure"
 * button runs, just on a schedule instead of a click. Pure arithmetic, same
 * as computeDecisionOutcome above: no AI call, so it costs nothing to run
 * and never depends on ANTHROPIC_API_KEY being set.
 *
 * Meant to be called once a day (see /api/cron/measure-decisions) — not
 * from a page request, for the same fan-out-cost reason CX Pulse's nightly
 * compute isn't either. A decision that isn't eligible yet (not_ready) or
 * still can't be measured (insufficient_data) is left alone and re-checked
 * on the next run rather than being marked failed.
 */
export async function autoMeasurePendingDecisions(now: Date = new Date()): Promise<{ checked: number; measured: number }> {
  const candidates = await DecisionLogEntry.find({
    implementationDate: { $ne: null },
    outcomeMetric: { $ne: null },
    outcomeMeasuredAt: null,
    // A decision only counts as real once it's actually marked
    // Implemented — without this, a "Planned" entry that already has an
    // implementation date and metric picked (e.g. someone planning ahead)
    // would get measured and emailed as a real verdict before the work is
    // even done. Status and the measurement engine were previously
    // disconnected; this is the fix.
    status: "implemented",
  });

  let measured = 0;
  for (const entry of candidates) {
    const result = await computeDecisionOutcome(
      {
        businessId: entry.businessId,
        parentOrgId: entry.parentOrgId,
        affectedBusinessIds: entry.affectedBusinessIds,
        implementationDate: entry.implementationDate,
        outcomeMetric: entry.outcomeMetric,
        outcomeCategoryId: entry.outcomeCategoryId,
      },
      now
    );

    if (result.verdict === "not_ready" || result.verdict === "insufficient_data") continue;

    entry.outcomeBefore = result.outcomeBefore;
    entry.outcomeAfter = result.outcomeAfter;
    entry.outcomeMeasuredAt = now;
    entry.outcomeSampleSizeBefore = result.sampleSizeBefore;
    entry.outcomeSampleSizeAfter = result.sampleSizeAfter;
    entry.outcomeLowConfidence = result.lowConfidence;
    await entry.save();
    measured++;

    await notifyDecisionOutcomeMeasured(
      { title: entry.title, ownerId: entry.ownerId, businessId: entry.businessId, parentOrgId: entry.parentOrgId },
      result,
      entry.outcomeMetric as DecisionOutcomeMetric
    );
  }

  return { checked: candidates.length, measured };
}
