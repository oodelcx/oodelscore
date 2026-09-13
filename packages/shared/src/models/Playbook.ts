import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export interface IPlaybook {
  // Exactly one of these is set, enforced at the API layer (not here) — see
  // the identical DecisionLogEntry fix: a standalone business (no parent
  // org) needs its own Playbooks scope.
  parentOrgId: Types.ObjectId | null;
  businessId: Types.ObjectId | null;
  title: string;
  categoryId: Types.ObjectId | null;
  triggerCondition: string; // e.g. "3+ mentions in 2 weeks"
  steps: string[];
  escalationContactId: Types.ObjectId | null;
  usageCount: number; // increment whenever an actionBoardItem references this playbook
  createdAt: Date;
  updatedAt: Date;
}

const PlaybookSchema = new Schema<IPlaybook>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", default: null },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", default: null },
    title: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    triggerCondition: { type: String, default: "" },
    steps: { type: [String], default: [] },
    escalationContactId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PlaybookSchema.index({ businessId: 1, categoryId: 1 });
PlaybookSchema.index({ parentOrgId: 1, categoryId: 1 });

export const Playbook: Model<IPlaybook> = mongoose.models.Playbook ?? model<IPlaybook>("Playbook", PlaybookSchema);
