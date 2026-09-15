import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export const DECISION_STATUSES = ["planned", "in_progress", "implemented"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const DECISION_OUTCOME_METRICS = ["starAverage", "nps", "categoryAverage"] as const;
export type DecisionOutcomeMetric = (typeof DECISION_OUTCOME_METRICS)[number];

export interface IDecisionLogEntry {
  // Exactly one of these is set, enforced at the API layer (not here): a
  // Group-created entry gets parentOrgId (org-wide), a standalone business's
  // entry gets businessId instead — mirrors the ActionBoardItem fix (spec
  // Section 16 correction), since a business with no parent org needs a
  // Decision Log too.
  parentOrgId: Types.ObjectId | null;
  businessId: Types.ObjectId | null;
  title: string;
  trigger: string;
  linkedActionIds: Types.ObjectId[];
  affectedBusinessIds: Types.ObjectId[];
  ownerId: Types.ObjectId | null;
  implementationDate: Date | null;
  status: DecisionStatus;
  outcomeMetricDescription: string;
  // When set, "Measure outcome" computes outcomeBefore/outcomeAfter from real
  // response data instead of requiring a manual number — the actual
  // Listen -> Act -> Measure close-the-loop step, not just a place to type
  // two numbers. outcomeCategoryId is required (and only meaningful) when
  // outcomeMetric === "categoryAverage".
  outcomeMetric: DecisionOutcomeMetric | null;
  outcomeCategoryId: Types.ObjectId | null;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
  outcomeMeasuredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DecisionLogEntrySchema = new Schema<IDecisionLogEntry>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", default: null },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", default: null },
    title: { type: String, required: true },
    trigger: { type: String, default: "" },
    linkedActionIds: { type: [Schema.Types.ObjectId], ref: "ActionBoardItem", default: [] },
    affectedBusinessIds: { type: [Schema.Types.ObjectId], ref: "Business", default: [] },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    implementationDate: { type: Date, default: null },
    status: { type: String, enum: DECISION_STATUSES, default: "planned" },
    outcomeMetricDescription: { type: String, default: "" },
    outcomeMetric: { type: String, enum: DECISION_OUTCOME_METRICS, default: null },
    outcomeCategoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    outcomeBefore: { type: Number, default: null },
    outcomeAfter: { type: Number, default: null },
    outcomeMeasuredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DecisionLogEntrySchema.index({ parentOrgId: 1, affectedBusinessIds: 1 });
DecisionLogEntrySchema.index({ businessId: 1 });

export const DecisionLogEntry: Model<IDecisionLogEntry> =
  mongoose.models.DecisionLogEntry ?? model<IDecisionLogEntry>("DecisionLogEntry", DecisionLogEntrySchema);
