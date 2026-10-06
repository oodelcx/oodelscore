import { Types } from "mongoose";
import { Response } from "../models/Response";
import type { IEvent } from "../models/Event";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { Business } from "../models/Business";
import { QuestionTemplate } from "../models/QuestionTemplate";

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

/** One survey question's results across every response to this event (open text is covered by `comments`). */
export interface ProgramEvaluationQuestionStat {
  question: string;
  type: string;
  responseCount: number;
  /** Mean for rating-type questions (stars, NPS, slider, emoji, effort); null for choice questions. */
  average: number | null;
  /** Counts per option for yes/no and choice questions. */
  distribution: Record<string, number> | null;
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
  questionStats: ProgramEvaluationQuestionStat[];
  topThemes: ProgramEvaluationThemeEntry[];
  comments: string[];
  meetsMinimumSample: boolean;
}

const NUMERIC_TYPES = new Set(["star_1_5", "nps_0_10", "slider", "emoji_scale", "ces_1_5"]);
const CHOICE_TYPES = new Set(["yes_no", "multiple_choice", "dropdown", "multi_select"]);

/**
 * Per-question results, so Program Evaluation can match each stated
 * objective to the survey question that actually asked about it instead of
 * only seeing one pooled star average. Question wording comes from the
 * Question Templates the event's feedback points used.
 */
async function buildQuestionStats(
  responses: { answers: { questionId?: Types.ObjectId | null; type: string; value: unknown }[]; feedbackPointId: Types.ObjectId }[],
  businessId: Types.ObjectId | string | undefined
): Promise<ProgramEvaluationQuestionStat[]> {
  if (responses.length === 0) return [];
  const pointIds = [...new Set(responses.map((r) => String(r.feedbackPointId)))];
  const points = await FeedbackPoint.find({ _id: { $in: pointIds } }).select("questionTemplateOverride businessId").lean();
  const templateIds = new Set<string>();
  for (const p of points) if (p.questionTemplateOverride) templateIds.add(String(p.questionTemplateOverride));
  if (templateIds.size === 0 || points.some((p) => !p.questionTemplateOverride)) {
    const owner = await Business.findById(businessId ?? points[0]?.businessId).select("questionTemplateId").lean();
    if (owner?.questionTemplateId) templateIds.add(String(owner.questionTemplateId));
  }
  const templates = await QuestionTemplate.find({ _id: { $in: [...templateIds] } }).lean();

  const defs = new Map<string, { text: string; type: string; order: number }>();
  let order = 0;
  for (const t of templates) {
    for (const q of t.questions) {
      if (q._id) defs.set(String(q._id), { text: q.text, type: q.type, order: order++ });
    }
  }

  const acc = new Map<string, { numbers: number[]; counts: Map<string, number>; n: number }>();
  for (const r of responses) {
    for (const a of r.answers) {
      const id = a.questionId ? String(a.questionId) : "";
      const def = defs.get(id);
      if (!def) continue;
      const entry = acc.get(id) ?? { numbers: [], counts: new Map<string, number>(), n: 0 };
      if (NUMERIC_TYPES.has(def.type) && typeof a.value === "number") {
        entry.numbers.push(a.value);
        entry.n++;
      } else if (CHOICE_TYPES.has(def.type)) {
        const values = Array.isArray(a.value) ? a.value : [a.value];
        let counted = false;
        for (const v of values) {
          if (typeof v === "string" && v) {
            entry.counts.set(v, (entry.counts.get(v) ?? 0) + 1);
            counted = true;
          }
        }
        if (counted) entry.n++;
      }
      acc.set(id, entry);
    }
  }

  return [...acc.entries()]
    .filter(([, v]) => v.n > 0)
    .map(([id, v]) => {
      const def = defs.get(id)!;
      return {
        order: def.order,
        stat: {
          question: def.text,
          type: def.type,
          responseCount: v.n,
          average: v.numbers.length ? Math.round((v.numbers.reduce((s, x) => s + x, 0) / v.numbers.length) * 100) / 100 : null,
          distribution: v.counts.size ? Object.fromEntries([...v.counts.entries()].sort((a, b) => b[1] - a[1])) : null,
        } as ProgramEvaluationQuestionStat,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((x) => x.stat);
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
  event: Pick<IEvent, "name"> & { businessId?: Types.ObjectId | string; programDetails?: { synopsis: string; objectives: string[]; expectedOutcomes: string[] } | null },
  eventId: Types.ObjectId | string
): Promise<ProgramEvaluationEvidence> {
  const responses = await Response.find({ eventId }).select("answers themes sentiment demographics feedbackPointId").lean();
  const questionStats = await buildQuestionStats(responses, event.businessId);

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
    questionStats,
    topThemes,
    comments: comments.slice(0, MAX_COMMENTS),
    meetsMinimumSample: responses.length >= MIN_SAMPLE_SIZE,
  };
}
