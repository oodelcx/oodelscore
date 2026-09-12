import { Types } from "mongoose";
import { AlertRule, type IAlertRule } from "../models/AlertRule";
import { AlertActivity } from "../models/AlertActivity";
import { Business } from "../models/Business";
import { computeBusinessMetrics } from "../scoring/aggregate";
import { sendTemplatedEmail } from "../email/resend";

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

async function recordFiringAndNotify(rule: IAlertRule & { _id: Types.ObjectId }, businessId: Types.ObjectId, value: number) {
  if (await isInCooldown(rule._id, businessId)) return;

  await AlertActivity.create({ alertRuleId: rule._id, businessId, triggeredAt: new Date(), snapshotValue: value });

  const business = await Business.findById(businessId);
  const businessName = business?.name ?? "A business";
  const alertLink = `${process.env.APP_URL ?? ""}/business`;

  for (const recipient of rule.recipients) {
    await sendTemplatedEmail("alert_notification", recipient, {
      name: recipient,
      business_name: businessName,
      alert_condition: `${rule.ruleType.replace(/_/g, " ")}: ${value}`,
      alert_link: alertLink,
    }).catch((err) => console.error("[alerts] failed to send alert_notification", err));
  }
}

/**
 * Real-time check, run right after a new response is written: fixed_threshold
 * and nps_floor are single-data-point comparisons, so there's no need to
 * wait for the hourly sweep (spec Section 10a).
 */
export async function evaluateRealTimeAlertsForBusiness(businessId: Types.ObjectId | string): Promise<void> {
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
    ruleType: { $in: ["fixed_threshold", "nps_floor"] },
    $or: ownerFilters,
  });
  if (rules.length === 0) return;

  const to = new Date();
  const from = new Date(to.getTime() - METRIC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const metrics = await computeBusinessMetrics(business._id, from, to);

  for (const rule of rules) {
    const value = rule.ruleType === "nps_floor" ? metrics.npsScore : metricValue(rule.metric, metrics);
    if (value === null || rule.threshold === null) continue;
    if (value < rule.threshold) {
      await recordFiringAndNotify(rule, business._id, value);
    }
  }
}

/**
 * Hourly sweep (spec Section 10a): regional_outlier and sudden_drop both
 * need a rolling baseline across more than one data point, so they can't be
 * evaluated inline on a single new response the way fixed_threshold/nps_floor
 * are above.
 */
export async function evaluateBaselineAlerts(): Promise<void> {
  const rules = await AlertRule.find({ active: true, ruleType: { $in: ["regional_outlier", "sudden_drop"] } });
  const to = new Date();

  for (const rule of rules) {
    const businesses = await resolveRuleBusinesses(rule);
    if (businesses.length === 0) continue;

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
          await recordFiringAndNotify(rule, business._id, currentValue);
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
          await recordFiringAndNotify(rule, business._id, value);
        }
      }
    }
  }
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
