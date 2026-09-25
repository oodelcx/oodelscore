import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * One personalized-but-anonymous survey link, minted for one RosterEntry
 * against one FeedbackPoint. This is the mechanism behind the
 * "roster-personalized links" distribution mode: an employee clicks a link
 * that's unique to them, the system resolves it to confirm it's valid and
 * unused, marks it used, and lets them answer — but the response itself
 * never references this token, this roster entry, or the person's email.
 * See effectiveDemographicConfig() in FeedbackPoint.ts for the matching
 * rule on the response side.
 *
 * rosterEntryId exists ONLY to (a) prevent minting a second live token for
 * the same person while one is already outstanding and (b) let a
 * participation-rate figure be computed ("310 of 450 tokens used") without
 * ever being joined back into Response. No code path may write
 * rosterEntryId (or anything derived from it) onto a Response document.
 */
export interface IRosterSurveyToken {
  token: string; // random, unguessable — the actual query param in the personalized link
  feedbackPointId: Types.ObjectId;
  rosterEntryId: Types.ObjectId;
  businessId: Types.ObjectId; // denormalized from the roster entry, for scoping without a join
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RosterSurveyTokenSchema = new Schema<IRosterSurveyToken>(
  {
    token: { type: String, required: true, unique: true },
    feedbackPointId: { type: Schema.Types.ObjectId, ref: "FeedbackPoint", required: true },
    rosterEntryId: { type: Schema.Types.ObjectId, ref: "RosterEntry", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// token already gets a unique index from `unique: true` above (the hot path
// on every personalized-link visit). One live (unused) token per person per
// survey is enforced in code at mint time, not here — a partial unique
// index on (feedbackPointId, rosterEntryId) WHERE usedAt IS NULL isn't
// expressible in a portable Mongoose schema index, so mintRosterSurveyTokens
// checks for an existing unused token before creating a new one.
RosterSurveyTokenSchema.index({ feedbackPointId: 1, rosterEntryId: 1 });

export const RosterSurveyToken: Model<IRosterSurveyToken> =
  mongoose.models.RosterSurveyToken ?? model<IRosterSurveyToken>("RosterSurveyToken", RosterSurveyTokenSchema);
