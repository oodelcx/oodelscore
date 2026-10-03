import { randomBytes } from "crypto";
import { Types } from "mongoose";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { RosterEntry, type IRosterEntry } from "../models/RosterEntry";
import { RosterSurveyToken } from "../models/RosterSurveyToken";
import { sendTemplatedEmail } from "../email/resend";

/**
 * Returns the roster entry's existing unused token for this feedback point
 * if one exists, otherwise mints and returns a new one. The single
 * building block both the bulk pulse mint below and the lifecycle-trigger
 * cron use — same idempotency guarantee (never double-issue a live token)
 * whether minting for a whole roster at once or for one person on their
 * lifecycle date.
 */
export async function ensureRosterSurveyToken(
  feedbackPointId: Types.ObjectId,
  rosterEntry: Pick<IRosterEntry, "businessId"> & { _id: Types.ObjectId }
): Promise<string> {
  const existing = await RosterSurveyToken.findOne({
    feedbackPointId,
    rosterEntryId: rosterEntry._id,
    usedAt: null,
  });
  if (existing) return existing.token;

  const token = randomBytes(24).toString("hex");
  await RosterSurveyToken.create({
    token,
    feedbackPointId,
    rosterEntryId: rosterEntry._id,
    businessId: rosterEntry.businessId,
    usedAt: null,
  });
  return token;
}

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

export interface SendRosterSurveyLinksResult {
  sent: number;
  failed: number;
  totalLive: number; // live (unused) tokens this run considered, minted or reused
}

/**
 * The manual "send now" action for a roster_personalized feedback point
 * (Business portal, Colleague Roster): ensures every active roster entry
 * has a live token (reusing mintRosterSurveyTokens' idempotency), then
 * emails everyone with a currently-live token their personalized link —
 * including anyone whose token was minted on an earlier call and never
 * used, so this doubles as a "resend" action. Never touches an already-used
 * token; nothing here can re-send to someone who already responded.
 */
export async function sendRosterSurveyLinks(feedbackPointId: Types.ObjectId | string): Promise<SendRosterSurveyLinksResult> {
  const feedbackPoint = await FeedbackPoint.findById(feedbackPointId);
  if (!feedbackPoint) throw new Error("Feedback point not found");

  await mintRosterSurveyTokens(feedbackPointId);

  const liveTokens = await RosterSurveyToken.find({ feedbackPointId: feedbackPoint._id, usedAt: null });
  if (liveTokens.length === 0) return { sent: 0, failed: 0, totalLive: 0 };

  const rosterEntries = await RosterEntry.find({ _id: { $in: liveTokens.map((t) => t.rosterEntryId) } }).select("email");
  const emailByEntryId = new Map(rosterEntries.map((e) => [e._id.toString(), e.email]));

  const appUrl = process.env.APP_URL ?? "";
  const result: SendRosterSurveyLinksResult = { sent: 0, failed: 0, totalLive: liveTokens.length };
  for (const token of liveTokens) {
    const email = emailByEntryId.get(token.rosterEntryId.toString());
    if (!email) continue;
    try {
      await sendTemplatedEmail("colleague_pulse_survey", email, {
        survey_link: `${appUrl}/feedback/${feedbackPoint.qrToken}?rt=${token.token}`,
      });
      result.sent++;
    } catch (err) {
      console.error("[ce] failed to send pulse survey link", err);
      result.failed++;
    }
  }
  return result;
}
