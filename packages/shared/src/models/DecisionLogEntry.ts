import { Schema, model, models, type Model, type Types } from "mongoose";

export const DECISION_STATUSES = ["planned", "in_progress", "implemented"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export interface IDecisionLogEntry {
  parentOrgId: Types.ObjectId;
  title: string;
  trigger: string;
  linkedActionIds: Types.ObjectId[];
  affectedBusinessIds: Types.ObjectId[];
  ownerId: Types.ObjectId | null;
  implementationDate: Date | null;
  status: DecisionStatus;
  outcomeMetricDescription: string;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
  outcomeMeasuredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DecisionLogEntrySchema = new Schema<IDecisionLogEntry>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", required: true },
    title: { type: String, required: true },
    trigger: { type: String, default: "" },
    linkedActionIds: { type: [Schema.Types.ObjectId], ref: "ActionBoardItem", default: [] },
    affectedBusinessIds: { type: [Schema.Types.ObjectId], ref: "Business", default: [] },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    implementationDate: { type: Date, default: null },
    status: { type: String, enum: DECISION_STATUSES, default: "planned" },
    outcomeMetricDescription: { type: String, default: "" },
    outcomeBefore: { type: Number, default: null },
    outcomeAfter: { type: Number, default: null },
    outcomeMeasuredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DecisionLogEntrySchema.index({ parentOrgId: 1, affectedBusinessIds: 1 });

export const DecisionLogEntry: Model<IDecisionLogEntry> =
  models.DecisionLogEntry ?? model<IDecisionLogEntry>("DecisionLogEntry", DecisionLogEntrySchema);
