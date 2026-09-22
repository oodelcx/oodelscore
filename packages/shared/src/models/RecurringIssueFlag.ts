import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import type { OwnerScope } from "./CategoryOwnerMapping";

export const RECURRING_FLAG_STATUSES = ["active", "converted", "dismissed"] as const;
export type RecurringFlagStatus = (typeof RECURRING_FLAG_STATUSES)[number];

/**
 * "The same problem keeps happening" — computed by
 * packages/shared/src/patterns/recurringIssues.ts, one row per (scope,
 * ownerScopeId, categoryId) currently over its configured repeat threshold
 * (see CategoryOwnerMapping.repeatThresholdCount/repeatWindowDays, which is
 * where Admin/the account sets "how many times before this counts as a
 * pattern").
 *
 * ownerScope "business" = the repeat is happening within one business/
 * branch's own cases. ownerScope "parentOrg" = the repeat spans two or more
 * businesses under the same org (a genuinely cross-branch pattern) — this
 * is deliberately a *different* row from any single branch's own flag for
 * the same category, so the org-level view and each branch's own view never
 * collide, and only a senior (org) user can act on the cross-branch one.
 */
export interface IRecurringIssueFlag {
  ownerScope: OwnerScope;
  ownerScopeId: Types.ObjectId; // -> businesses._id or parentOrganizations._id
  categoryId: Types.ObjectId;
  caseIds: Types.ObjectId[]; // -> actionBoardItems._id, the cases behind this flag
  businessIds: Types.ObjectId[]; // distinct businesses the caseIds span (1 for a business-scope flag)
  count: number;
  windowDays: number;
  firstCaseAt: Date;
  lastCaseAt: Date;
  status: RecurringFlagStatus;
  convertedInitiativeId: Types.ObjectId | null;
  dismissedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RecurringIssueFlagSchema = new Schema<IRecurringIssueFlag>(
  {
    ownerScope: { type: String, enum: ["business", "parentOrg"], required: true },
    ownerScopeId: { type: Schema.Types.ObjectId, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    caseIds: { type: [Schema.Types.ObjectId], ref: "ActionBoardItem", default: [] },
    businessIds: { type: [Schema.Types.ObjectId], ref: "Business", default: [] },
    count: { type: Number, required: true },
    windowDays: { type: Number, required: true },
    firstCaseAt: { type: Date, required: true },
    lastCaseAt: { type: Date, required: true },
    status: { type: String, enum: RECURRING_FLAG_STATUSES, default: "active" },
    convertedInitiativeId: { type: Schema.Types.ObjectId, ref: "ImprovementInitiative", default: null },
    dismissedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RecurringIssueFlagSchema.index({ ownerScope: 1, ownerScopeId: 1, categoryId: 1, status: 1 }, { unique: false });

export const RecurringIssueFlag: Model<IRecurringIssueFlag> =
  mongoose.models.RecurringIssueFlag ?? model<IRecurringIssueFlag>("RecurringIssueFlag", RecurringIssueFlagSchema);
