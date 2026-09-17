import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";

export const PLAYBOOK_RUN_STATUSES = ["active", "completed", "abandoned"] as const;
export type PlaybookRunStatus = (typeof PLAYBOOK_RUN_STATUSES)[number];

/**
 * One in-progress or finished use of a Playbook — the "operational
 * guidance, not just a document" piece of the CX intelligence roadmap
 * (Phase 4). `steps` is a snapshot of the playbook's steps at the moment
 * the run started, so a later edit to the template never rewrites history
 * on an in-progress or already-completed run.
 *
 * A run is either tied to one specific Case (`actionBoardItemId` set — the
 * "auto-attach on case creation" flow, or a manual "attach playbook to this
 * case" action) or ad-hoc against the whole business/org (`actionBoardItemId`
 * null — the original "Run playbook" button on the standalone Playbooks/
 * Library page). "Only one active run at a time" is enforced in the API
 * routes that create runs, keyed on (playbookId, actionBoardItemId) when a
 * case is attached, or (playbookId, ownerId) for an ad-hoc run — not by a
 * unique Mongo index, so callers must still check-then-create.
 */
export interface IPlaybookRun {
  playbookId: Types.ObjectId;
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  // Set when this run is attached to one specific Case (ActionBoardItem);
  // null for an ad-hoc, business/org-wide run started from the Playbook
  // Library. See the uniqueness note above.
  actionBoardItemId: Types.ObjectId | null;
  // Human-readable "why this run exists" — populated for auto-attached runs
  // (either the structured trigger's description, or a generic "standard
  // playbook for <category>" fallback when the playbook has no structured
  // trigger). Left as "" for manually-started runs.
  attachReason: string;
  steps: string[];
  completedStepIndexes: number[];
  status: PlaybookRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  // Who transitioned this run to completed/abandoned, set by the PATCH
  // handler. Null until then (and for runs finished before this field
  // existed).
  completedByUserId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlaybookRunSchema = new Schema<IPlaybookRun>(
  {
    playbookId: { type: Schema.Types.ObjectId, ref: "Playbook", required: true },
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    actionBoardItemId: { type: Schema.Types.ObjectId, ref: "ActionBoardItem", default: null },
    attachReason: { type: String, default: "" },
    steps: { type: [String], default: [] },
    completedStepIndexes: { type: [Number], default: [] },
    status: { type: String, enum: PLAYBOOK_RUN_STATUSES, default: "active" },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    completedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

PlaybookRunSchema.index({ playbookId: 1, ownerType: 1, ownerId: 1, status: 1 });
// Looking up a case's current/most-recent run — the case-list and run-detail
// endpoints both key off this.
PlaybookRunSchema.index({ actionBoardItemId: 1, status: 1 });

export const PlaybookRun: Model<IPlaybookRun> =
  mongoose.models.PlaybookRun ?? model<IPlaybookRun>("PlaybookRun", PlaybookRunSchema);
