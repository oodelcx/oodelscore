import { randomBytes } from "crypto";
import { Types } from "mongoose";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { RosterEntry } from "../models/RosterEntry";
import { RosterSurveyToken } from "../models/RosterSurveyToken";

export interface MintRosterSurveyTokensResult {
  minted: number; // new tokens created this run
  alreadyIssued: number; // roster entries that already had a live (unused) token, skipped
  totalActive: number; // active roster entries considered
}

/**
 * Mints one personalized survey link per active roster entry at the
 * feedback point's business, for the "roster-personalized links"
 * distribution mode. Idempotent: an active roster entry that already has
 * an unused token for this feedback point is skipped, not re-minted — so
 * this is safe to call repeatedly (e.g. once per pulse cycle) without
 * flooding people with duplicate links while a previous one is still live.
 *
 * "Active" here means endDate is null — someone marked as exited isn't
 * sent the ongoing pulse survey; exit surveys are a separate, lifecycle-
 * triggered path, not this bulk mint.
 */
export async function mintRosterSurveyTokens(feedbackPointId: Types.ObjectId | string): Promise<MintRosterSurveyTokensResult> {
  const feedbackPoint = await FeedbackPoint.findById(feedbackPointId);
  if (!feedbackPoint) throw new Error("Feedback point not found");

  const activeEntries = await RosterEntry.find({ businessId: feedbackPoint.businessId, endDate: null });
  if (activeEntries.length === 0) {
    return { minted: 0, alreadyIssued: 0, totalActive: 0 };
  }

  const existingLiveTokens = await RosterSurveyToken.find({
    feedbackPointId: feedbackPoint._id,
    rosterEntryId: { $in: activeEntries.map((e) => e._id) },
    usedAt: null,
  }).select("rosterEntryId");
  const alreadyIssuedIds = new Set(existingLiveTokens.map((t) => t.rosterEntryId.toString()));

  const toMint = activeEntries.filter((e) => !alreadyIssuedIds.has(e._id.toString()));
  if (toMint.length > 0) {
    await RosterSurveyToken.insertMany(
      toMint.map((entry) => ({
        token: randomBytes(24).toString("hex"),
        feedbackPointId: feedbackPoint._id,
        rosterEntryId: entry._id,
        businessId: feedbackPoint.businessId,
        usedAt: null,
      }))
    );
  }

  return { minted: toMint.length, alreadyIssued: alreadyIssuedIds.size, totalActive: activeEntries.length };
}
