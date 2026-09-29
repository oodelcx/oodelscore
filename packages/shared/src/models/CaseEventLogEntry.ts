import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * Append-only case history — one row per state transition a Case
 * (ActionBoardItem) goes through that isn't already captured by an
 * existing append-only source (escalationHistory for the escalation chain,
 * ActionItemComment for conversation). Never updated or deleted after
 * creation; the case trail merges this with escalationHistory into one
 * chronological timeline (see caseEventLog.ts's getCaseTimeline).
 *
 * Deliberately NOT a duplicate of escalationHistory or comments — this
 * covers the gap those two don't: a case's status/priority/owner had no
 * record of WHEN or BY WHOM it changed, only its current value.
 */
export const CASE_EVENT_KINDS = ["status_changed", "priority_changed", "owner_changed", "customer_notified"] as const;
export type CaseEventKind = (typeof CASE_EVENT_KINDS)[number];

export interface ICaseEventLogEntry {
  actionBoardItemId: Types.ObjectId;
  businessId: Types.ObjectId; // denormalized so a scoped query never needs a join
  kind: CaseEventKind;
  fromValue: string | null;
  toValue: string | null;
  actorUserId: Types.ObjectId | null;
  actorLabel: string; // resolved email at write time, so the timeline never needs a join to render
  note: string;
  createdAt: Date;
}

const CaseEventLogEntrySchema = new Schema<ICaseEventLogEntry>(
  {
    actionBoardItemId: { type: Schema.Types.ObjectId, ref: "ActionBoardItem", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    kind: { type: String, enum: CASE_EVENT_KINDS, required: true },
    fromValue: { type: String, default: null },
    toValue: { type: String, default: null },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorLabel: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CaseEventLogEntrySchema.index({ actionBoardItemId: 1, createdAt: 1 });

export const CaseEventLogEntry: Model<ICaseEventLogEntry> =
  mongoose.models.CaseEventLogEntry ?? model<ICaseEventLogEntry>("CaseEventLogEntry", CaseEventLogEntrySchema);
