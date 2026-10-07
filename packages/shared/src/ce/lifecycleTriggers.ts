import { FeedbackPoint } from "../models/FeedbackPoint";
import { RosterEntry, type LifecycleStage } from "../models/RosterEntry";
import { ensureRosterSurveyToken } from "./rosterTokens";
import { sendTemplatedEmail } from "../email/resend";
import { Business } from "../models/Business";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A new-starter check-in is only meaningful close to the person's real 30/90
 * day mark. Someone whose start date is already further past than this when
 * the cron first sees them (e.g. a business uploading its whole existing
 * workforce with real start dates) is long-serving, not new: that stage is
 * marked handled WITHOUT sending, so they never get a "how is your first
 * month" email and nobody is flooded on day one.
 */
export const ONBOARDING_GRACE_DAYS = 21;

/** Start-date range in which an onboarding stage is genuinely due: [now-days-grace, now-days]. */
export function onboardingDueWindow(days: number, now: Date): { from: Date; to: Date } {
  return { from: new Date(now.getTime() - (days + ONBOARDING_GRACE_DAYS) * DAY_MS), to: new Date(now.getTime() - days * DAY_MS) };
}

export interface LifecycleTriggerResult {
  sent: number;
  skippedLongServing: number; // start date long past the stage's window — marked handled, not emailed
  skippedNoSurvey: number; // roster entry was due, but its business has no feedback point set up for that stage
  failed: number; // sendTemplatedEmail threw (e.g. RESEND_API_KEY not configured) — logged, not fatal to the run
}

/**
 * Daily sweep for Colleague Experience's lifecycle-triggered surveys:
 * onboarding day-30, onboarding day-90, and exit. For each stage, finds
 * roster entries that just became due and haven't already been sent that
 * stage's survey (RosterEntry.triggeredStages), looks up the business's
 * designated feedback point for that stage (FeedbackPoint.lifecycleTrigger
 * — see that field's comment), mints/reuses that person's token, and
 * emails them the link. A business that hasn't set up a survey for a given
 * stage is silently skipped — this is expected, not an error, since
 * lifecycle surveys are opt-in per stage.
 *
 * Marking a stage as triggered happens only after a successful send, so a
 * transient failure (Resend down, key misconfigured) naturally retries on
 * the next day's run instead of silently losing that person's survey.
 */
export async function runColleagueLifecycleTriggers(now: Date = new Date()): Promise<LifecycleTriggerResult> {
  const result: LifecycleTriggerResult = { sent: 0, skippedLongServing: 0, skippedNoSurvey: 0, failed: 0 };

  await markLongServingHandled(30, now, result);
  await markLongServingHandled(90, now, result);
  await fireStage("onboarding_30", await dueForOnboarding(30, now), result);
  await fireStage("onboarding_90", await dueForOnboarding(90, now), result);
  await fireStage("exit", await dueForExit(now), result);

  return result;
}

async function dueForOnboarding(days: number, now: Date) {
  const stage: LifecycleStage = days === 30 ? "onboarding_30" : "onboarding_90";
  const { from, to } = onboardingDueWindow(days, now);
  return RosterEntry.find({
    startDate: { $ne: null, $gte: from, $lte: to },
    endDate: null, // still active — someone who already left doesn't get an onboarding check-in
    triggeredStages: { $ne: stage },
  });
}

async function markLongServingHandled(days: number, now: Date, result: LifecycleTriggerResult): Promise<void> {
  const stage: LifecycleStage = days === 30 ? "onboarding_30" : "onboarding_90";
  const { from } = onboardingDueWindow(days, now);
  const res = await RosterEntry.updateMany(
    { startDate: { $ne: null, $lt: from }, endDate: null, triggeredStages: { $ne: stage } },
    { $addToSet: { triggeredStages: stage } }
  );
  result.skippedLongServing += res.modifiedCount ?? 0;
}

async function dueForExit(now: Date) {
  return RosterEntry.find({
    endDate: { $ne: null, $lte: now },
    triggeredStages: { $ne: "exit" },
  });
}

async function fireStage(
  stage: LifecycleStage,
  dueEntries: Awaited<ReturnType<typeof dueForOnboarding>>,
  result: LifecycleTriggerResult
): Promise<void> {
  if (dueEntries.length === 0) return;

  // Group by business so the "does this business have a survey for this
  // stage" lookup happens once per business, not once per person.
  const byBusiness = new Map<string, typeof dueEntries>();
  for (const entry of dueEntries) {
    const key = entry.businessId.toString();
    const list = byBusiness.get(key) ?? [];
    list.push(entry);
    byBusiness.set(key, list);
  }

  for (const [businessId, entries] of byBusiness) {
    const business = stage === "exit" ? await Business.findById(businessId).select("exitSurveyPersonalEmailEnabled") : null;
    const usePersonalEmail = !!business?.exitSurveyPersonalEmailEnabled;
    const feedbackPoint = await FeedbackPoint.findOne({
      businessId,
      product: "colleague_experience",
      lifecycleTrigger: stage,
      active: true,
    });
    if (!feedbackPoint) {
      result.skippedNoSurvey += entries.length;
      continue;
    }

    for (const entry of entries) {
      try {
        const token = await ensureRosterSurveyToken(feedbackPoint._id, entry);
        const appUrl = process.env.APP_URL ?? "";
        // Exit survey: personal address only when the business turned that on
        // AND one was recorded; otherwise the work address, as before.
        const recipient = stage === "exit" && usePersonalEmail && entry.personalEmail ? entry.personalEmail : entry.email;
        await sendTemplatedEmail("colleague_lifecycle_survey", recipient, {
          survey_link: `${appUrl}/feedback/${feedbackPoint.qrToken}?rt=${token}`,
        });
        entry.triggeredStages.push(stage);
        // Data minimisation: the personal address has done its one job.
        if (stage === "exit") entry.personalEmail = "";
        await entry.save();
        result.sent++;
      } catch (err) {
        console.error(`[ce-lifecycle-triggers] failed to send ${stage} to a roster entry`, err);
        result.failed++;
      }
    }
  }
}
