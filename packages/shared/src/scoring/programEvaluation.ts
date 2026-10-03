import { Types } from "mongoose";
import { Event } from "../models/Event";
import { Business } from "../models/Business";
import { ProgramEvaluationReport, type IProgramEvaluationReport } from "../models/ProgramEvaluationReport";
import { hasFeature } from "../features/flags";
import { gatherProgramEvaluationEvidence } from "./programEvaluationEvidence";
import { analyzeProgramEvaluation } from "../ai/programEvaluation";

// Wait this long after an Event's endsAt before evaluating it, so
// responses submitted in the days right after a training still get
// counted — evaluating the instant the clock hits endsAt would otherwise
// systematically undercount.
export const PROGRAM_EVALUATION_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Runs (or re-runs) Program Evaluation for one training Event, saving the
 * result. Used by both the nightly cron (generateDueProgramEvaluations)
 * and a business's manual "re-run" action — same function either way, so
 * the two paths can never disagree about how a report is built.
 */
export async function generateProgramEvaluationForEvent(eventId: Types.ObjectId | string): Promise<IProgramEvaluationReport | null> {
  const event = await Event.findById(eventId);
  if (!event || event.category !== "training") return null;

  const evidence = await gatherProgramEvaluationEvidence(event, event._id);

  if (!evidence.meetsMinimumSample) {
    return ProgramEvaluationReport.findOneAndUpdate(
      { eventId: event._id },
      {
        $set: {
          businessId: event.businessId,
          status: "insufficient_data",
          synopsis: evidence.synopsis,
          objectives: evidence.objectives,
          expectedOutcomes: evidence.expectedOutcomes,
          responseCount: evidence.responseCount,
          starAverage: evidence.starAverage,
          npsScore: evidence.npsScore,
          ageGroupCuts: evidence.ageGroupCuts,
          genderCuts: evidence.genderCuts,
          topThemes: evidence.topThemes.map((t) => t.theme),
          summary: `Only ${evidence.responseCount} response${evidence.responseCount === 1 ? "" : "s"} so far — not enough to evaluate against objectives yet.`,
          objectiveMatches: [],
          suggestions: [],
          newAreasToExplore: [],
          generatedByAi: false,
          fallbackReason: null,
          generatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }

  const narrative = await analyzeProgramEvaluation(evidence);

  return ProgramEvaluationReport.findOneAndUpdate(
    { eventId: event._id },
    {
      $set: {
        businessId: event.businessId,
        status: "completed",
        synopsis: evidence.synopsis,
        objectives: evidence.objectives,
        expectedOutcomes: evidence.expectedOutcomes,
        responseCount: evidence.responseCount,
        starAverage: evidence.starAverage,
        npsScore: evidence.npsScore,
        ageGroupCuts: evidence.ageGroupCuts,
        genderCuts: evidence.genderCuts,
        topThemes: evidence.topThemes.map((t) => t.theme),
        summary: narrative.summary,
        objectiveMatches: narrative.objectiveMatches,
        suggestions: narrative.suggestions,
        newAreasToExplore: narrative.newAreasToExplore,
        generatedByAi: narrative.generatedByAi,
        fallbackReason: narrative.fallbackReason,
        generatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

export interface ProgramEvaluationRunResult {
  eventsEvaluated: number;
  eventsSkippedInsufficientData: number;
}

/**
 * The cron entry point (see /api/cron/program-evaluation). Finds every
 * training Event that's past its grace period, belongs to a business with
 * Program Evaluation turned on, and doesn't already have a report —
 * running it once is enough; a late straggler response doesn't trigger an
 * automatic re-run, only a manual one does.
 */
export async function generateDueProgramEvaluations(now: Date = new Date()): Promise<ProgramEvaluationRunResult> {
  const cutoff = new Date(now.getTime() - PROGRAM_EVALUATION_GRACE_DAYS * DAY_MS);

  const dueEvents = await Event.find({ category: "training", endsAt: { $ne: null, $lte: cutoff } }).select("_id businessId");
  if (dueEvents.length === 0) return { eventsEvaluated: 0, eventsSkippedInsufficientData: 0 };

  const alreadyReported = new Set(
    (await ProgramEvaluationReport.find({ eventId: { $in: dueEvents.map((e) => e._id) } }).select("eventId")).map((r) => r.eventId.toString())
  );
  const pending = dueEvents.filter((e) => !alreadyReported.has(e._id.toString()));
  if (pending.length === 0) return { eventsEvaluated: 0, eventsSkippedInsufficientData: 0 };

  const businesses = await Business.find({ _id: { $in: pending.map((e) => e.businessId) } }).select("enabledFeatures");
  const enabledBusinessIds = new Set(
    businesses.filter((b) => hasFeature(b.enabledFeatures, "programEvaluation")).map((b) => b._id.toString())
  );

  let eventsEvaluated = 0;
  let eventsSkippedInsufficientData = 0;
  for (const evt of pending) {
    if (!enabledBusinessIds.has(evt.businessId.toString())) continue;
    const report = await generateProgramEvaluationForEvent(evt._id);
    if (!report) continue;
    if (report.status === "insufficient_data") eventsSkippedInsufficientData++;
    else eventsEvaluated++;
  }

  return { eventsEvaluated, eventsSkippedInsufficientData };
}
