import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export const ACTION_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_STATUSES = ["open", "in_progress", "resolved"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_SOURCES = ["manual", "auto_suggested", "auto_assigned", "escalated"] as const;
export type ActionSource = (typeof ACTION_SOURCES)[number];

export interface IActionBoardItem {
  // null when businessId is a standalone business (spec Section 16 correction:
  // AI-assisted triage fires on any business's Alert Rule, including one with
  // no parent org, so the Act layer can no longer require a group).
  parentOrgId: Types.ObjectId | null;
  title: string;
  description: string;
  businessId: Types.ObjectId;
  categoryId: Types.ObjectId | null;
  priority: ActionPriority;
  status: ActionStatus;
  ownerId: Types.ObjectId | null;
  dueDate: Date | null;
  sourceResponseIds: Types.ObjectId[]; // linked feedback that generated this item
  resolutionNote: string;
  resolvedAt: Date | null;
  source: ActionSource;
  createdAt: Date;
  updatedAt: Date;
}

const ActionBoardItemSchema = new Schema<IActionBoardItem>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", default: null },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    priority: { type: String, enum: ACTION_PRIORITIES, default: "medium" },
    status: { type: String, enum: ACTION_STATUSES, default: "open" },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: { type: Date, default: null },
    sourceResponseIds: { type: [Schema.Types.ObjectId], ref: "Response", default: [] },
    resolutionNote: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    source: { type: String, enum: ACTION_SOURCES, default: "manual" },
  },
  { timestamps: true }
);

ActionBoardItemSchema.index({ businessId: 1, status: 1, dueDate: 1 });

ActionBoardItemSchema.index({ parentOrgId: 1, status: 1, dueDate: 1 });

export const ActionBoardItem: Model<IActionBoardItem> =
  mongoose.models.ActionBoardItem ?? model<IActionBoardItem>("ActionBoardItem", ActionBoardItemSchema);
