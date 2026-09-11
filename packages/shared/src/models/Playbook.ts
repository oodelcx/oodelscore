import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IPlaybook {
  parentOrgId: Types.ObjectId;
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
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", required: true },
    title: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    triggerCondition: { type: String, default: "" },
    steps: { type: [String], default: [] },
    escalationContactId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Playbook: Model<IPlaybook> = models.Playbook ?? model<IPlaybook>("Playbook", PlaybookSchema);
