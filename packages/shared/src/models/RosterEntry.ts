import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * Colleague Experience's employee roster — deliberately minimal. Email and
 * which business/branch someone belongs to, plus the two dates that drive
 * lifecycle-triggered surveys (onboarding day-30/90, exit). No name, no
 * phone, nothing else identifying: this list exists only to (a) generate
 * and send personalized-but-anonymous survey tokens and (b) know when to
 * fire a lifecycle survey — never to be browsed as a staff directory. See
 * effectiveDemographicConfig() in FeedbackPoint.ts for the same discipline
 * applied to the response side of Colleague Experience.
 *
 * A future roster-management UI must be write-only from the account's own
 * point of view (upload/add/remove, no "view roster" screen) — the model
 * itself doesn't enforce that (there's nothing to enforce structurally
 * here, unlike the anonymity floor), but it's the intended usage this
 * model exists to support and any route/UI built on it must honor it.
 */
export const LIFECYCLE_STAGES = ["onboarding_30", "onboarding_90", "exit"] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export interface IRosterEntry {
  businessId: Types.ObjectId; // which business/branch this person belongs to
  email: string;
  startDate: Date | null; // drives onboarding_30/onboarding_90 triggers
  endDate: Date | null; // set once known — drives the exit trigger; null = still active
  // Which lifecycle stages have already fired for this person, so the daily
  // cron never sends the same onboarding/exit survey twice. Appended to,
  // never cleared.
  triggeredStages: LifecycleStage[];
  createdAt: Date;
  updatedAt: Date;
}

const RosterEntrySchema = new Schema<IRosterEntry>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    triggeredStages: { type: [String], enum: LIFECYCLE_STAGES, default: [] },
  },
  { timestamps: true }
);

// One roster row per email per business — re-uploading the same list is
// idempotent (upsert on this pair) rather than creating duplicates.
RosterEntrySchema.index({ businessId: 1, email: 1 }, { unique: true });
// The daily lifecycle-trigger cron scans for anyone whose startDate/endDate
// might newly cross a threshold — filtered by business is the natural
// per-account batch, but a platform-wide scan also needs to walk every
// entry with an unset stage, so index the dates directly too.
RosterEntrySchema.index({ startDate: 1 });
RosterEntrySchema.index({ endDate: 1 });

export const RosterEntry: Model<IRosterEntry> =
  mongoose.models.RosterEntry ?? model<IRosterEntry>("RosterEntry", RosterEntrySchema);
