import { Types } from "mongoose";
import { CompassAssessment, type ICompassAnswer } from "../models/CompassAssessment";
import { CompassAssessmentHistory, type ICompassAssessmentHistory } from "../models/CompassAssessmentHistory";
import { PlatformSettings, PLATFORM_SETTINGS_SINGLETON_KEY } from "../models/PlatformSettings";
import type { BillingOwnerType } from "../models/BillingSubscription";
import type { Product } from "../models/products";
import { questionsForProducts, type AnchorDimension } from "./questionBank";
import { computeCompassResult, type LadderValue } from "./scoring";
import { computeEvidenceFusion } from "./evidenceFusion";

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
  const defs = await questionsForProducts(products);
  const questions: CompassQuestionView[] = defs.map((q) => {
    const existing = assessment.answers.find((a) => a.questionKey === q.key);
    return { key: q.key, dimension: q.dimension, text: q.text, value: existing?.value ?? null };
  });

  const history = await getCompassHistory(ownerType, ownerId);

  let dueForReassessment = false;
  let reassessmentDueAt: Date | null = null;
  if (assessment.status === "completed" && assessment.completedAt) {
    const settings = await PlatformSettings.findOne({ singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY });
    const cadenceDays = settings?.compassReassessmentCadenceDays ?? null;
    if (cadenceDays) {
      reassessmentDueAt = new Date(assessment.completedAt.getTime() + cadenceDays * 24 * 60 * 60 * 1000);
      dueForReassessment = reassessmentDueAt.getTime() <= Date.now();
    }
  }

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
            evidence: assessment.evidence ?? [],
            completedAt: assessment.completedAt,
          }
        : null,
    dueForReassessment,
    reassessmentDueAt,
    history,
  };
}

/** Past completed cycles, most recent first — see CompassAssessmentHistory. */
export async function getCompassHistory(
  ownerType: BillingOwnerType,
  ownerId: Types.ObjectId
): Promise<ICompassAssessmentHistory[]> {
  return CompassAssessmentHistory.find({ ownerType, ownerId }).sort({ completedAt: -1 });
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
  value: LadderValue,
  questionText: string
): Promise<void> {
  const assessment = await getOrCreateAssessment(ownerType, ownerId, industry);
  const existingIndex = assessment.answers.findIndex((a) => a.questionKey === questionKey);
  const entry: ICompassAnswer = { questionKey, dimension, value, questionText };
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
    assessment.evidence = [];
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

  const defs = await questionsForProducts(products);
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
  // Keep the "claimed vs proven" picture as it stands today, so the next retake can be compared with it.
  try {
    const fusion = await computeEvidenceFusion(
      ownerType,
      ownerId,
      result.dimensionScores.map((d) => ({ dimension: d.dimension, score: d.score })),
      products
    );
    assessment.evidence = fusion.dimensions.map((d) => ({
      dimension: d.dimension,
      selfScore: d.selfScore,
      evidenceScore: d.evidenceScore,
      status: d.status,
    }));
  } catch (err) {
    console.error("[compass] could not snapshot evidence at completion", err);
    assessment.evidence = [];
  }
  await assessment.save();

  return { ok: true };
}

/**
 * Clears every answer and returns the assessment to a blank draft — a
 * deliberate re-take, not just re-editing one answer. If the assessment
 * being restarted was completed, its result is archived to
 * CompassAssessmentHistory first (OBS2) so the retake has something to be
 * compared against — restarting a still-in-progress draft archives nothing.
 */
export async function restartCompassAssessment(ownerType: BillingOwnerType, ownerId: Types.ObjectId): Promise<void> {
  const assessment = await CompassAssessment.findOne({ ownerType, ownerId });
  if (
    assessment &&
    assessment.status === "completed" &&
    assessment.completedAt &&
    assessment.dimensionScores &&
    assessment.overallScore !== null &&
    assessment.stage &&
    assessment.index !== null
  ) {
    await CompassAssessmentHistory.create({
      ownerType,
      ownerId,
      industry: assessment.industry,
      dimensionScores: assessment.dimensionScores,
      overallScore: assessment.overallScore,
      stage: assessment.stage,
      gatingDimensions: assessment.gatingDimensions,
      index: assessment.index,
      evidence: assessment.evidence ?? [],
      completedAt: assessment.completedAt,
    });
  }

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
        evidence: [],
        completedAt: null,
      },
    }
  );
}
