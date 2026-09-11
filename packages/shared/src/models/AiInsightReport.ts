import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";

export const AI_REPORT_PERIODS = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type AiReportPeriod = (typeof AI_REPORT_PERIODS)[number];

export const AI_REPORT_STATUSES = ["pending", "approved", "rejected"] as const;
export type AiReportStatus = (typeof AI_REPORT_STATUSES)[number];

/**
 * Rule (spec Section 2/10): nothing here is visible on a Group/Business
 * dashboard while status is "pending". Approval triggers the report_ready
 * email and flips visibility. Generation and publication are separate steps.
 */
export interface IAiInsightReport {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  period: AiReportPeriod;
  periodStart: Date;
  periodEnd: Date;
  bodyMarkdown: string; // AI-generated, admin-editable before publish
  status: AiReportStatus;
  showChartOnDashboard: boolean;
  generatedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AiInsightReportSchema = new Schema<IAiInsightReport>(
  {
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    period: { type: String, enum: AI_REPORT_PERIODS, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    bodyMarkdown: { type: String, default: "" },
    status: { type: String, enum: AI_REPORT_STATUSES, default: "pending" },
    showChartOnDashboard: { type: Boolean, default: true },
    generatedAt: { type: Date, required: true, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

AiInsightReportSchema.index({ ownerType: 1, ownerId: 1, period: 1, periodStart: 1 });

export const AiInsightReport: Model<IAiInsightReport> =
  mongoose.models.AiInsightReport ?? model<IAiInsightReport>("AiInsightReport", AiInsightReportSchema);
