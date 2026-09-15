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
 */
export interface IPlaybookRun {
  playbookId: Types.ObjectId;
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  steps: string[];
  completedStepIndexes: number[];
  status: PlaybookRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlaybookRunSchema = new Schema<IPlaybookRun>(
  {
    playbookId: { type: Schema.Types.ObjectId, ref: "Playbook", required: true },
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    steps: { type: [String], default: [] },
    completedStepIndexes: { type: [Number], default: [] },
    status: { type: String, enum: PLAYBOOK_RUN_STATUSES, default: "active" },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PlaybookRunSchema.index({ playbookId: 1, ownerType: 1, ownerId: 1, status: 1 });

export const PlaybookRun: Model<IPlaybookRun> =
  mongoose.models.PlaybookRun ?? model<IPlaybookRun>("PlaybookRun", PlaybookRunSchema);
