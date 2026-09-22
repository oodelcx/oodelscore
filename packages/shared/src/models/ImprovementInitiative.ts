import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export const INITIATIVE_STATUSES = ["planned", "in_progress", "completed"] as const;
export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];

/**
 * The systemic counterpart to a routine case: "waiting time is repeatedly
 * poor across 8 branches" is not one customer's complaint, it's a pattern
 * across many. An Improvement Initiative groups the cases that surfaced the
 * pattern under one owner, one baseline, and one measured target — kept
 * separate from DecisionLogEntry, which records that management chose a
 * change, not the operational program behind it. A Decision Log entry may
 * reference the initiative that drove it (see DecisionLogEntry once it
 * grows a link), but the initiative is the thing with a baseline/target
 * that gets tracked over its own lifetime.
 */
export interface IImprovementInitiative {
  parentOrgId: Types.ObjectId | null; // null when owned by a standalone business
  businessId: Types.ObjectId | null; // set only for a standalone business's own initiative
  title: string;
  description: string;
  ownerId: Types.ObjectId | null;
  affectedBusinessIds: Types.ObjectId[];
  linkedActionIds: Types.ObjectId[]; // the routine cases that revealed this pattern
  status: InitiativeStatus;
  baselineMetricDescription: string; // e.g. "Average wait-time rating"
  baselineValue: number | null;
  targetValue: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ImprovementInitiativeSchema = new Schema<IImprovementInitiative>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", default: null },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", default: null },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    affectedBusinessIds: { type: [Schema.Types.ObjectId], ref: "Business", default: [] },
    linkedActionIds: { type: [Schema.Types.ObjectId], ref: "ActionBoardItem", default: [] },
    status: { type: String, enum: INITIATIVE_STATUSES, default: "planned" },
    baselineMetricDescription: { type: String, default: "" },
    baselineValue: { type: Number, default: null },
    targetValue: { type: Number, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ImprovementInitiativeSchema.index({ parentOrgId: 1 });
ImprovementInitiativeSchema.index({ businessId: 1 });

export const ImprovementInitiative: Model<IImprovementInitiative> =
  mongoose.models.ImprovementInitiative ?? model<IImprovementInitiative>("ImprovementInitiative", ImprovementInitiativeSchema);
