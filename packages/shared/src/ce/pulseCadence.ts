import { FeedbackPoint, isFeedbackPointOpen } from "../models/FeedbackPoint";
import { sendRosterSurveyLinks } from "./rosterTokens";

const DAY_MS = 24 * 60 * 60 * 1000;
const CADENCE_INTERVAL_MS: Record<"weekly" | "monthly", number> = {
  weekly: 7 * DAY_MS,
  monthly: 30 * DAY_MS,
};

export interface PulseCadenceResult {
  sent: number; // feedback points a send was attempted for
  skipped: number; // due points skipped because they're currently closed (inactive or outside their date window)
  failed: number; // sendRosterSurveyLinks threw for a point — logged, not fatal to the run
}

/**
 * Daily sweep for Colleague Experience's recurring pulse survey cadence:
 * any roster_personalized feedback point with a pulseCadence set (and no
 * lifecycleTrigger — that's a separate, per-person-triggered path) that's
 * due — lastSentAt is null, or old enough for its cadence — gets sent via
 * sendRosterSurveyLinks, same idempotent mint-then-email path the manual
 * "send now" button uses. A business can still send/resend manually at any
 * time from the Colleague Roster page; this just automates the routine
 * cadence so nobody has to remember to click the button every week/month.
 */
export async function runColleagueRosterPulseCadence(now: Date = new Date()): Promise<PulseCadenceResult> {
  const result: PulseCadenceResult = { sent: 0, skipped: 0, failed: 0 };

  const candidates = await FeedbackPoint.find({
    product: "colleague_experience",
    distributionMode: "roster_personalized",
    lifecycleTrigger: null,
    pulseCadence: { $ne: null },
  });

  for (const point of candidates) {
    if (!point.pulseCadence) continue; // narrows the type; the query already filtered this
    const intervalMs = CADENCE_INTERVAL_MS[point.pulseCadence];
    const due = !point.lastSentAt || now.getTime() - point.lastSentAt.getTime() >= intervalMs;
    if (!due) continue;

    if (!isFeedbackPointOpen(point, now)) {
      result.skipped++;
      continue;
    }

    try {
      await sendRosterSurveyLinks(point._id);
      point.lastSentAt = now;
      await point.save();
      result.sent++;
    } catch (err) {
      console.error("[ce-pulse-cadence] failed to send a recurring pulse survey", err);
      result.failed++;
    }
  }

  return result;
}
