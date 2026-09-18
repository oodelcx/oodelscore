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
  // Set only for auto-created items (source auto_suggested/auto_assigned):
  // a short, evidence-grounded recommended next step, generated the same
  // evidence-gated way Root Cause Analysis is (see ai/rootCause.ts) — never
  // free-form guessing. Empty string when there wasn't enough evidence to
  // generate one, or after it's been dismissed.
  suggestedAction: string;
  // Group-level oversight signal (product decision: Group is read-only on
  // branch Action Board items — assignment/status/priority is the branch's
  // job — but a Group Head can flag something for attention). Distinct from
  // `source: "escalated"`, which describes how an item was *created*, not a
  // flag layered on top of an existing branch-owned item. Doesn't touch the
  // Decision Log — that stays keyed off the branch's own resolution.
  escalated: boolean;
  escalatedAt: Date | null;
  // Set when a Group user escalates — why they flagged it, shown to whoever
  // gets the item_escalated email (the item's assigned owner, or the
  // branch's owner if nobody's assigned yet) so the flag isn't a mystery.
  escalationNote: string;
  // The other direction: a branch flagging its own case for its parent
  // org's attention (only meaningful when businessId belongs to a branch,
  // not a standalone business — there's nobody to escalate to otherwise).
  // Deliberately a separate field from `escalated` above rather than
  // reusing it — that one is documented as a Group→branch oversight
  // signal, and conflating the two directions would make a branch's own
  // escalation look like (and get cleared/toggled by) Group's read-only
  // flag, or vice versa.
  escalatedToOrg: boolean;
  escalatedToOrgAt: Date | null;
  escalatedToOrgNote: string;
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
    suggestedAction: { type: String, default: "" },
    escalated: { type: Boolean, default: false },
    escalatedAt: { type: Date, default: null },
    escalationNote: { type: String, default: "" },
    escalatedToOrg: { type: Boolean, default: false },
    escalatedToOrgAt: { type: Date, default: null },
    escalatedToOrgNote: { type: String, default: "" },
  },
  { timestamps: true }
);

ActionBoardItemSchema.index({ businessId: 1, status: 1, dueDate: 1 });

ActionBoardItemSchema.index({ parentOrgId: 1, status: 1, dueDate: 1 });

export const ActionBoardItem: Model<IActionBoardItem> =
  mongoose.models.ActionBoardItem ?? model<IActionBoardItem>("ActionBoardItem", ActionBoardItemSchema);
