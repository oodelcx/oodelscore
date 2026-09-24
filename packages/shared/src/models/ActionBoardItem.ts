import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { PRODUCTS, type Product } from "./products";

export const ACTION_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_STATUSES = ["open", "in_progress", "resolved"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_SOURCES = ["manual", "auto_suggested", "auto_assigned", "escalated"] as const;
export type ActionSource = (typeof ACTION_SOURCES)[number];

// What kind of response this case actually needs — distinguishes "say
// sorry to this one customer" from "fix the underlying process," which
// were previously the same undifferentiated Action Board item.
// "operational_fix" is the default: the safest read of what most existing
// cases already are.
export const CASE_TYPES = ["customer_recovery", "operational_fix", "investigation"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const ESCALATION_TRAIL_ACTIONS = ["escalated", "auto_escalated"] as const;
export type EscalationTrailAction = (typeof ESCALATION_TRAIL_ACTIONS)[number];

// One entry per level this case has passed through — the audit trail behind
// the "case trail" view (who held it, how long, what happened). Appended by
// escalateActionBoardItem() in packages/shared/src/escalation.ts; never
// edited or removed afterward.
export interface IEscalationHistoryEntry {
  level: number; // the level the case was AT when this entry was recorded
  userId: Types.ObjectId | null; // whoever held it at that level, if resolved
  action: EscalationTrailAction;
  note: string;
  at: Date;
}

const EscalationHistoryEntrySchema = new Schema<IEscalationHistoryEntry>(
  {
    level: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, enum: ESCALATION_TRAIL_ACTIONS, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

export interface IActionBoardItem {
  // null when businessId is a standalone business (spec Section 16 correction:
  // AI-assisted triage fires on any business's Alert Rule, including one with
  // no parent org, so the Act layer can no longer require a group).
  parentOrgId: Types.ObjectId | null;
  // Which product this case belongs to — defaults to customer_experience so
  // every case that predates Colleague Experience is unaffected.
  product: Product;
  title: string;
  description: string;
  businessId: Types.ObjectId;
  categoryId: Types.ObjectId | null;
  caseType: CaseType;
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
  // The configured escalation chain (packages/shared/src/escalation.ts):
  // which level currently owns this case, when it entered that level (the
  // cron's SLA clock), and the full history of every level it has passed
  // through. Level 1 = the branch's own owner, always, by convention.
  currentEscalationLevel: number;
  levelEnteredAt: Date;
  escalationHistory: IEscalationHistoryEntry[];
  // Set the moment a personal reply is sent to the customer who left the
  // linked feedback (see the business/group respond-to-customer route) —
  // closing the loop on their end, not just internally marking the case
  // resolved. Null until that happens; stays null forever for a case with
  // no respondent email captured.
  customerNotifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ActionBoardItemSchema = new Schema<IActionBoardItem>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", default: null },
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    caseType: { type: String, enum: CASE_TYPES, default: "operational_fix" },
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
    currentEscalationLevel: { type: Number, default: 1 },
    levelEnteredAt: { type: Date, default: Date.now },
    escalationHistory: { type: [EscalationHistoryEntrySchema], default: [] },
    customerNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ActionBoardItemSchema.index({ businessId: 1, status: 1, dueDate: 1 });

ActionBoardItemSchema.index({ parentOrgId: 1, status: 1, dueDate: 1 });

export const ActionBoardItem: Model<IActionBoardItem> =
  mongoose.models.ActionBoardItem ?? model<IActionBoardItem>("ActionBoardItem", ActionBoardItemSchema);
