import { Types } from "mongoose";
import { CompassAssessment, type ICompassAnswer } from "../models/CompassAssessment";
import type { BillingOwnerType } from "../models/BillingSubscription";
import type { Product } from "../models/products";
import { questionsForProducts, type AnchorDimension } from "./questionBank";
import { computeCompassResult, type LadderValue } from "./scoring";
import { resolveIndustryContent, renderQuestionText } from "./industryContent";

/**
 * Owner-agnostic OodelCX Compass assessment logic — identical for a
 * business and a parent org (same ownerType/ownerId convention as
 * CxGoal), so the business/group API routes both call this instead of
 * duplicating the load/answer/submit/restart logic.
 */

export interface CompassQuestionView {
  key: string;
  dimension: AnchorDimension;
  text: string;
  value: LadderValue | null;
}

/** Creates the account's one assessment row the first time it's touched. */
async function getOrCreateAssessment(ownerType: BillingOwnerType, ownerId: Types.ObjectId, industry: string) {
  const existing = await CompassAssessment.findOne({ ownerType, ownerId });
  if (existing) return existing;
  return CompassAssessment.create({ ownerType, ownerId, industry, status: "draft", answers: [] });
}

export async function getCompassView(
  ownerType: BillingOwnerType,
  ownerId: Types.ObjectId,
  industry: string,
  products: readonly Product[]
) {
  const assessment = await getOrCreateAssessment(ownerType, ownerId, industry);
  const content = await resolveIndustryContent(assessment.industry || industry);
  const defs = questionsForProducts(products);
  const questions: CompassQuestionView[] = defs.map((q) => {
    const existing = assessment.answers.find((a) => a.questionKey === q.key);
    return { key: q.key, dimension: q.dimension, text: renderQuestionText(q.text, content), value: existing?.value ?? null };
  });

  return {
    assessmentStatus: assessment.status,
    industry: assessment.industry,
    questions,
    answeredCount: assessment.answers.length,
    totalCount: defs.length,
    result:
      assessment.status === "completed"
        ? {
            dimensionScores: assessment.dimensionScores,
            overallScore: assessment.overallScore,
            stage: assessment.stage,
            gatingDimensions: assessment.gatingDimensions,
            index: assessment.index,
            completedAt: assessment.completedAt,
          }
        : null,
  };
}

/**
 * Upserts one answer. Re-answering an already-answered question overwrites
 * its own entry (never appends a duplicate). Answering after completion
 * silently reopens the assessment to draft — the account is editing a
 * finished assessment, so its stale results snapshot is cleared until the
 * next submit recomputes it.
 */
export async function submitCompassAnswer(
  ownerType: BillingOwnerType,
  ownerId: Types.ObjectId,
  industry: string,
  questionKey: string,
  dimension: AnchorDimension,
  value: LadderValue
): Promise<void> {
  const assessment = await getOrCreateAssessment(ownerType, ownerId, industry);
  const existingIndex = assessment.answers.findIndex((a) => a.questionKey === questionKey);
  const entry: ICompassAnswer = { questionKey, dimension, value };
  if (existingIndex === -1) {
    assessment.answers.push(entry);
  } else {
    assessment.answers[existingIndex] = entry;
  }
  if (assessment.status === "completed") {
    assessment.status = "draft";
    assessment.dimensionScores = null;
    assessment.overallScore = null;
    assessment.stage = null;
    assessment.gatingDimensions = [];
    assessment.index = null;
    assessment.completedAt = null;
  }
  await assessment.save();
}

export interface CompassSubmitResult {
  ok: boolean;
  message?: string;
  missingCount?: number;
}

/** Finalizes the assessment — requires every question for the account's current product set to be answered first. */
export async function completeCompassAssessment(
  ownerType: BillingOwnerType,
  ownerId: Types.ObjectId,
  products: readonly Product[]
): Promise<CompassSubmitResult> {
  const assessment = await CompassAssessment.findOne({ ownerType, ownerId });
  if (!assessment) return { ok: false, message: "No assessment found — answer at least one question first." };

  const defs = questionsForProducts(products);
  const answeredKeys = new Set(assessment.answers.map((a) => a.questionKey));
  const missing = defs.filter((q) => !answeredKeys.has(q.key));
  if (missing.length > 0) {
    return { ok: false, message: `${missing.length} question${missing.length === 1 ? "" : "s"} still need an answer.`, missingCount: missing.length };
  }

  const result = computeCompassResult(assessment.answers);
  assessment.status = "completed";
  assessment.dimensionScores = result.dimensionScores.map((d) => ({ dimension: d.dimension, score: d.score }));
  assessment.overallScore = result.overallScore;
  assessment.stage = result.stage;
  assessment.gatingDimensions = result.gatingDimensions;
  assessment.index = result.index;
  assessment.completedAt = new Date();
  await assessment.save();

  return { ok: true };
}

/** Clears every answer and returns the assessment to a blank draft — a deliberate re-take, not just re-editing one answer. */
export async function restartCompassAssessment(ownerType: BillingOwnerType, ownerId: Types.ObjectId): Promise<void> {
  await CompassAssessment.findOneAndUpdate(
    { ownerType, ownerId },
    {
      $set: {
        status: "draft",
        answers: [],
        dimensionScores: null,
        overallScore: null,
        stage: null,
        gatingDimensions: [],
        index: null,
        completedAt: null,
      },
    }
  );
}
