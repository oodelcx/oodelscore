import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * Who actually holds a given escalation level, for a Parent Org (scoped by
 * region — one Cluster Manager can cover many branches without one row per
 * branch) or a standalone Business (org-wide only, since there's nothing to
 * regionalize below a single business). Level 1 is deliberately never
 * assigned here — it always defaults to the branch/business's own owner
 * login (see packages/shared/src/escalation.ts), so onboarding only ever
 * has to configure level 2 and above.
 */
export interface IEscalationAssignment {
  parentOrgId: Types.ObjectId | null; // set for a Group's assignment
  businessId: Types.ObjectId | null; // set only for a standalone business's own assignment
  region: string; // "" = org-wide/business-wide; non-empty = scoped to that region's branches
  level: number; // matches a level number in the owner's escalationLevels config
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EscalationAssignmentSchema = new Schema<IEscalationAssignment>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", default: null },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", default: null },
    region: { type: String, default: "" },
    level: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

EscalationAssignmentSchema.index({ parentOrgId: 1, level: 1, region: 1 });
EscalationAssignmentSchema.index({ businessId: 1, level: 1 });

export const EscalationAssignment: Model<IEscalationAssignment> =
  mongoose.models.EscalationAssignment ?? model<IEscalationAssignment>("EscalationAssignment", EscalationAssignmentSchema);
