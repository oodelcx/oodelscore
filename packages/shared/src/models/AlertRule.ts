import { Schema, model, models, type Model, type Types } from "mongoose";

export const ALERT_SCOPES = ["business", "parentOrg_all", "parentOrg_region"] as const;
export type AlertScope = (typeof ALERT_SCOPES)[number];

export const ALERT_RULE_TYPES = ["fixed_threshold", "regional_outlier", "sudden_drop", "nps_floor"] as const;
export type AlertRuleType = (typeof ALERT_RULE_TYPES)[number];

export const ALERT_DELIVERY_MODES = ["immediate", "weekly_digest"] as const;
export type AlertDeliveryMode = (typeof ALERT_DELIVERY_MODES)[number];

export interface IAlertRule {
  scope: AlertScope;
  ownerId: Types.ObjectId; // business or parentOrg that owns this rule
  ruleType: AlertRuleType;
  metric: string;
  threshold: number | null; // for fixed_threshold / nps_floor
  sensitivity: number | null; // std deviations, for regional_outlier
  baselineWindowDays: number | null; // for sudden_drop
  dropPercent: number | null; // for sudden_drop
  recipients: string[];
  delivery: AlertDeliveryMode;
  active: boolean;
  isInherited: boolean; // true when set by parentOrg/admin and cascaded to a business — read-only there
  createdAt: Date;
  updatedAt: Date;
}

const AlertRuleSchema = new Schema<IAlertRule>(
  {
    scope: { type: String, enum: ALERT_SCOPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    ruleType: { type: String, enum: ALERT_RULE_TYPES, required: true },
    metric: { type: String, default: "" },
    threshold: { type: Number, default: null },
    sensitivity: { type: Number, default: null },
    baselineWindowDays: { type: Number, default: null },
    dropPercent: { type: Number, default: null },
    recipients: { type: [String], default: [] },
    delivery: { type: String, enum: ALERT_DELIVERY_MODES, default: "immediate" },
    active: { type: Boolean, default: true },
    isInherited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AlertRule: Model<IAlertRule> = models.AlertRule ?? model<IAlertRule>("AlertRule", AlertRuleSchema);
