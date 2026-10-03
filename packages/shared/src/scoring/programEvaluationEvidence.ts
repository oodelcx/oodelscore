import { Types } from "mongoose";
import { Response } from "../models/Response";
import type { IEvent } from "../models/Event";

const MIN_SAMPLE_SIZE = 5; // below this, evaluating reads as confident conclusions from almost nothing
const MAX_COMMENTS = 40;

export interface ProgramEvaluationDemographicCut {
  label: string;
  responseCount: number;
  starAverage: number | null;
}

export interface ProgramEvaluationThemeEntry {
  theme: string;
  frequency: number;
  positiveCount: number;
  negativeCount: number;
}

export interface ProgramEvaluationEvidence {
  eventName: string;
  synopsis: string;
  objectives: string[];
  expectedOutcomes: string[];
  responseCount: number;
  starAverage: number | null;
  npsScore: number | null;
  ageGroupCuts: ProgramEvaluationDemographicCut[];
  genderCuts: ProgramEvaluationDemographicCut[];
  topThemes: ProgramEvaluationThemeEntry[];
  comments: string[];
  meetsMinimumSample: boolean;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100;
}

/**
 * Gathers everything Program Evaluation's AI narration is allowed to see
 * for one training Event — real aggregate scores, real demographic cuts
 * (only from whatever the survey's own demographic config actually
 * collected), real recurring themes, and real open-text comments. The AI
 * step (../ai/programEvaluation.ts) is only ever shown this bundle, same
 * evidence-gated discipline as Root Cause Analysis — it never free-
 * associates about a training it has no data on.
 */
export async function gatherProgramEvaluationEvidence(
  event: Pick<IEvent, "name"> & { programDetails?: { synopsis: string; objectives: string[]; expectedOutcomes: string[] } | null },
  eventId: Types.ObjectId | string
): Promise<ProgramEvaluationEvidence> {
  const responses = await Response.find({ eventId }).select("answers themes sentiment demographics").lean();

  const stars: number[] = [];
  const npsValues: number[] = [];
  const comments: string[] = [];
  const ageGroupAgg = new Map<string, { stars: number[] }>();
  const genderAgg = new Map<string, { stars: number[] }>();
  const themeAgg = new Map<string, ProgramEvaluationThemeEntry>();

  for (const response of responses) {
    let starValue: number | null = null;
    let npsValue: number | null = null;
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number") {
        starValue = answer.value;
        stars.push(answer.value);
      } else if (answer.type === "nps_0_10" && typeof answer.value === "number") {
        npsValue = answer.value;
        npsValues.push(answer.value);
      } else if (answer.type === "open_text" && typeof answer.value === "string" && answer.value.trim()) {
        comments.push(answer.value.trim());
      }
    }

    const ageGroup = response.demographics?.ageGroup?.trim();
    if (ageGroup) {
      const agg = ageGroupAgg.get(ageGroup) ?? { stars: [] };
      if (starValue !== null) agg.stars.push(starValue);
      ageGroupAgg.set(ageGroup, agg);
    }
    const gender = response.demographics?.gender?.trim();
    if (gender) {
      const agg = genderAgg.get(gender) ?? { stars: [] };
      if (starValue !== null) agg.stars.push(starValue);
      genderAgg.set(gender, agg);
    }

    for (const theme of response.themes) {
      const agg = themeAgg.get(theme) ?? { theme, frequency: 0, positiveCount: 0, negativeCount: 0 };
      agg.frequency++;
      if (response.sentiment === "positive") agg.positiveCount++;
      else if (response.sentiment === "negative") agg.negativeCount++;
      themeAgg.set(theme, agg);
    }
  }

  function toCuts(agg: Map<string, { stars: number[] }>): ProgramEvaluationDemographicCut[] {
    return [...agg.entries()]
      .map(([label, v]) => ({ label, responseCount: v.stars.length, starAverage: average(v.stars) }))
      .sort((a, b) => b.responseCount - a.responseCount);
  }

  const topThemes = [...themeAgg.values()].sort((a, b) => b.frequency - a.frequency).slice(0, 10);

  return {
    eventName: event.name,
    synopsis: event.programDetails?.synopsis ?? "",
    objectives: event.programDetails?.objectives ?? [],
    expectedOutcomes: event.programDetails?.expectedOutcomes ?? [],
    responseCount: responses.length,
    starAverage: average(stars),
    npsScore: npsValues.length > 0 ? Math.round(((npsValues.filter((v) => v >= 9).length - npsValues.filter((v) => v <= 6).length) / npsValues.length) * 100) : null,
    ageGroupCuts: toCuts(ageGroupAgg),
    genderCuts: toCuts(genderAgg),
    topThemes,
    comments: comments.slice(0, MAX_COMMENTS),
    meetsMinimumSample: responses.length >= MIN_SAMPLE_SIZE,
  };
}
