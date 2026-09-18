import { Types, type HydratedDocument } from "mongoose";
import { AlertRule, type IAlertRule } from "../models/AlertRule";
import { AlertActivity } from "../models/AlertActivity";
import { Business, type IBusiness } from "../models/Business";
import { Category } from "../models/Category";
import { CategoryOwnerMapping } from "../models/CategoryOwnerMapping";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { User } from "../models/User";
import { autoAttachPlaybook } from "../scoring/caseAutoAttach";
import { computeBusinessMetrics } from "../scoring/aggregate";
import { sendTemplatedEmail } from "../email/resend";
import { generateTriageSuggestion } from "../ai/triage";
import { gatherRootCauseEvidence } from "../scoring/rootCauseEvidence";
import { analyzeRootCause } from "../ai/rootCause";

const METRIC_WINDOW_DAYS = 30;

// A rule evaluates a rolling average, not a single new data point — without
// a cooldown, every subsequent submission while that average stays under
// threshold re-fires and re-emails every recipient again. One notification
// per rule per business per cooldown window is enough to act on.
const ALERT_COOLDOWN_MINUTES = 60;

async function isInCooldown(ruleId: Types.ObjectId, businessId: Types.ObjectId): Promise<boolean> {
  const cutoff = new Date(Date.now() - ALERT_COOLDOWN_MINUTES * 60 * 1000);
  const recent = await AlertActivity.findOne({ alertRuleId: ruleId, businessId, triggeredAt: { $gte: cutoff } });
  return !!recent;
}

function metricValue(metric: string, metrics: { starAverage: number | null; npsScore: number | null }): number | null {
  if (metric === "nps") return metrics.npsScore;
  return metrics.starAverage; // default metric is the star average
}

/**
 * Spec Section 16.4: AI-assisted Action Board triage. Creates the item
 * automatically instead of waiting for a manual "Log action taken" — the AI
 * only picks title/severity/category; the owner always comes from the
 * human-configured categoryOwnerMappings, never from the AI.
 */
async function autoTriageAndCreateActionItem(
  business: HydratedDocument<IBusiness>,
  ruleDescription: string,
  triggeringComment: string | null
) {
  const categories = await Category.find();
  const suggestion = await generateTriageSuggestion({
    comment: triggeringComment,
    ruleDescription,
    categories: categories.map((c) => ({ id: c._id.toString(), name: c.name })),
  });

  // A branch can set its own owner for a category from its own Category
  // Owners page — that's always checked first. Only when the branch hasn't
  // set one does the org-wide default (set on the Group's Category Owners
  // page) apply. A standalone business only ever has the business-scope
  // mapping, since it has no org to fall back to.
  const mapping = suggestion.categoryId
    ? (await CategoryOwnerMapping.findOne({
        ownerScope: "business",
        ownerScopeId: business._id,
        categoryId: suggestion.categoryId,
      })) ??
      (business.parentOrgId
        ? await CategoryOwnerMapping.findOne({
            ownerScope: "parentOrg",
            ownerScopeId: business.parentOrgId,
            categoryId: suggestion.categoryId,
          })
        : null)
    : null;

  // A category owner mapping means items in that category always go
  // straight to that owner — no unassigned "suggested" state, no separate
  // accept/reassign step. Manual reassignment afterward (the owner dropdown
  // on each Action Board item) is unrelated and still works as before.
  const ownerId = mapping?.defaultOwnerId ?? null;

  // Same evidence-gated approach Root Cause Analysis already uses (see
  // ai/rootCause.ts): only ever hand Haiku a real computed evidence bundle,
  // never the raw comment/rule text to free-associate from. Only possible
  // when triage matched a real category — with no category there's nothing
  // to gather evidence for, so the item is created without a suggestion
  // rather than guessing one.
  const suggestedAction = suggestion.categoryId
    ? await (async () => {
        try {
          const evidence = await gatherRootCauseEvidence([business._id], suggestion.categoryId as string);
          const analysis = await analyzeRootCause(evidence);
          return analysis.recommendation.description;
        } catch (err) {
          console.error("[alerts] suggested-action evidence gathering failed", err);
          return "";
        }
      })()
    : "";

  const item = await ActionBoardItem.create({
    parentOrgId: business.parentOrgId ?? null,
    businessId: business._id,
    title: suggestion.title,
    description: triggeringComment ? `Respondent comment: "${triggeringComment}"` : "",
    categoryId: suggestion.categoryId,
    priority: suggestion.priority,
    ownerId,
    source: mapping ? "auto_assigned" : "auto_suggested",
    suggestedAction,
  });

  await autoAttachPlaybook(item).catch((err) => console.error("[alerts] auto-attach playbook failed", err));

  // Notify the owner that they've been assigned this item — no confirmation
  // language, since the assignment already happened.
  if (mapping) {
    const owner = await User.findById(mapping.defaultOwnerId);
    if (owner) {
      await sendTemplatedEmail("action_assigned", owner.email, {
        name: owner.email,
        action_title: item.title,
        due_date: "no due date",
        action_link: `${process.env.APP_URL ?? ""}/business`,
      }).catch((err) => console.error("[alerts] failed to send action_assigned for AI triage", err));
    }
  }
}

/** Returns false when the rule was still in cooldown and nothing was recorded. */
async function recordFiringAndNotify(
  rule: IAlertRule & { _id: Types.ObjectId },
  businessId: Types.ObjectId,
  value: number,
  triggeringComment: string | null = null
): Promise<boolean> {
  if (await isInCooldown(rule._id, businessId)) return false;

  await AlertActivity.create({ alertRuleId: rule._id, businessId, triggeredAt: new Date(), snapshotValue: value });

  const business = await Business.findById(businessId);
  const businessName = business?.name ?? "A business";
  const alertLink = `${process.env.APP_URL ?? ""}/business`;
  const ruleDescription = `${rule.ruleType.replace(/_/g, " ")}: ${value}`;

  for (const recipient of rule.recipients) {
    await sendTemplatedEmail("alert_notification", recipient, {
      name: recipient,
      business_name: businessName,
      alert_condition: ruleDescription,
      alert_link: alertLink,
    }).catch((err) => console.error("[alerts] failed to send alert_notification", err));
  }

  if (business) {
    await autoTriageAndCreateActionItem(business, ruleDescription, triggeringComment).catch((err) =>
      console.error("[alerts] AI-assisted triage failed", err)
    );
  }

  return true;
}

/**
 * Real-time check, run right after a new response is written: fixed_threshold
 * is a single-data-point comparison, so there's no need to wait for the
 * hourly sweep (spec Section 10a). `triggeringComment` (the new response's
 * open-text answer, if any) feeds AI-assisted triage — spec Section 16.4.
 */
export async function evaluateRealTimeAlertsForBusiness(
  businessId: Types.ObjectId | string,
  triggeringComment: string | null = null
): Promise<void> {
  const business = await Business.findById(businessId);
  if (!business) return;

  const ownerFilters: Record<string, unknown>[] = [{ scope: "business", ownerId: business._id }];
  if (business.parentOrgId) {
    ownerFilters.push({ scope: "parentOrg_all", ownerId: business.parentOrgId });
    if (business.region) {
      ownerFilters.push({ scope: "parentOrg_region", ownerId: business.parentOrgId, region: business.region });
    }
  }

  const rules = await AlertRule.find({
    active: true,
    ruleType: "fixed_threshold",
    $or: ownerFilters,
  });
  if (rules.length === 0) return;

  const to = new Date();
  const from = new Date(to.getTime() - METRIC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const metrics = await computeBusinessMetrics(business._id, from, to);

  for (const rule of rules) {
    const value = metricValue(rule.metric, metrics);
    if (value === null || rule.threshold === null) continue;
    if (value < rule.threshold) {
      await recordFiringAndNotify(rule, business._id, value, triggeringComment);
    }
  }
}

export interface BaselineAlertSweepResult {
  /** Rules that had at least one business in scope to evaluate. */
  rulesEvaluated: number;
  /** Firings actually recorded — rules still in cooldown are not counted. */
  alertsFired: number;
}

/**
 * Hourly sweep (spec Section 10a): regional_outlier and sudden_drop both
 * need a rolling baseline across more than one data point, so they can't be
 * evaluated inline on a single new response the way fixed_threshold is
 * above. No single triggering response exists for these, so AI triage
 * runs without a comment (title falls back to describing the rule).
 */
export async function evaluateBaselineAlerts(): Promise<BaselineAlertSweepResult> {
  const rules = await AlertRule.find({ active: true, ruleType: { $in: ["regional_outlier", "sudden_drop"] } });
  const to = new Date();

  let rulesEvaluated = 0;
  let alertsFired = 0;

  for (const rule of rules) {
    const businesses = await resolveRuleBusinesses(rule);
    if (businesses.length === 0) continue;
    rulesEvaluated += 1;

    if (rule.ruleType === "sudden_drop" && rule.baselineWindowDays && rule.dropPercent !== null) {
      const currentFrom = new Date(to.getTime() - METRIC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const baselineTo = currentFrom;
      const baselineFrom = new Date(baselineTo.getTime() - rule.baselineWindowDays * 24 * 60 * 60 * 1000);

      for (const business of businesses) {
        const current = await computeBusinessMetrics(business._id, currentFrom, to);
        const baseline = await computeBusinessMetrics(business._id, baselineFrom, baselineTo);
        const currentValue = metricValue(rule.metric, current);
        const baselineValue = metricValue(rule.metric, baseline);
        if (currentValue === null || baselineValue === null || baselineValue === 0) continue;

        const dropPercent = ((baselineValue - currentValue) / baselineValue) * 100;
        if (dropPercent >= rule.dropPercent) {
          if (await recordFiringAndNotify(rule, business._id, currentValue)) alertsFired += 1;
        }
      }
    }

    if (rule.ruleType === "regional_outlier" && rule.sensitivity !== null) {
      const from = new Date(to.getTime() - METRIC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const perBusiness = await Promise.all(
        businesses.map(async (business) => ({
          business,
          value: metricValue(rule.metric, await computeBusinessMetrics(business._id, from, to)),
        }))
      );
      const values = perBusiness.map((b) => b.value).filter((v): v is number => v !== null);
      if (values.length < 2) continue;

      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev === 0) continue;

      for (const { business, value } of perBusiness) {
        if (value === null) continue;
        if (value < mean - rule.sensitivity * stdDev) {
          if (await recordFiringAndNotify(rule, business._id, value)) alertsFired += 1;
        }
      }
    }
  }

  return { rulesEvaluated, alertsFired };
}

async function resolveRuleBusinesses(rule: IAlertRule) {
  if (rule.scope === "business") {
    const business = await Business.findById(rule.ownerId);
    return business ? [business] : [];
  }
  if (rule.scope === "parentOrg_region") {
    return Business.find({ parentOrgId: rule.ownerId, region: rule.region });
  }
  return Business.find({ parentOrgId: rule.ownerId });
}
