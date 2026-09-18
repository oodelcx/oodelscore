import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export const ALERT_SCOPES = ["business", "parentOrg_all", "parentOrg_region"] as const;
export type AlertScope = (typeof ALERT_SCOPES)[number];

// "nps_floor" used to exist as a separate type here, but it was a fake
// distinction: the evaluation code always used metrics.npsScore for it
// regardless of what the Metric dropdown said, which is exactly the same
// behavior as fixed_threshold with metric:"nps" — the same condition,
// reachable two different confusing ways. Removed; pick NPS as the Metric
// on a Fixed threshold rule instead.
export const ALERT_RULE_TYPES = ["fixed_threshold", "regional_outlier", "sudden_drop"] as const;
export type AlertRuleType = (typeof ALERT_RULE_TYPES)[number];

export interface IAlertRule {
  scope: AlertScope;
  ownerId: Types.ObjectId; // business or parentOrg that owns this rule
  region: string; // only meaningful when scope is "parentOrg_region" — matches businesses.region
  ruleType: AlertRuleType;
  metric: string;
  threshold: number | null; // for fixed_threshold
  sensitivity: number | null; // std deviations, for regional_outlier
  baselineWindowDays: number | null; // for sudden_drop
  dropPercent: number | null; // for sudden_drop
  recipients: string[];
  active: boolean;
  isInherited: boolean; // true when set by parentOrg/admin and cascaded to a business — read-only there
  createdAt: Date;
  updatedAt: Date;
}

const AlertRuleSchema = new Schema<IAlertRule>(
  {
    scope: { type: String, enum: ALERT_SCOPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    region: { type: String, default: "" },
    ruleType: { type: String, enum: ALERT_RULE_TYPES, required: true },
    metric: { type: String, default: "" },
    threshold: { type: Number, default: null },
    sensitivity: { type: Number, default: null },
    baselineWindowDays: { type: Number, default: null },
    dropPercent: { type: Number, default: null },
    recipients: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    isInherited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AlertRule: Model<IAlertRule> = mongoose.models.AlertRule ?? model<IAlertRule>("AlertRule", AlertRuleSchema);
