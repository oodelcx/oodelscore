import { ANCHOR_DIMENSIONS, type AnchorDimension } from "./questionBank";

/**
 * OodelCX Compass's gate-based scoring engine — see PRODUCT-ROADMAP.md
 * Phase 7 "Scoring" for the full spec and the product owner's sign-off.
 * Every question is answered on this fixed ladder, never free text or
 * yes/no, so it's machine-scorable and comparable across every account.
 */
export const COMPASS_LADDER_LABELS = ["Absent", "Ad hoc", "Defined", "Embedded"] as const;
export type LadderValue = 0 | 1 | 2 | 3;

// A dimension needs at least this score to count toward "Established" —
// confirmed by the product owner. Applies at both the dimension gate and
// the overall stage gate (see computeCompassResult below).
export const COMPASS_ESTABLISHED_THRESHOLD: LadderValue = 2;

export const COMPASS_STAGES = ["established", "emerging"] as const;
export type CompassStage = (typeof COMPASS_STAGES)[number];

export interface CompassAnswerInput {
  questionKey: string;
  dimension: AnchorDimension;
  value: LadderValue;
}

export interface CompassDimensionResult {
  dimension: AnchorDimension;
  // The MIN of every answer in this dimension — a dimension is only as
  // strong as its weakest answer, not the average of its answers.
  score: LadderValue;
  answerCount: number;
}

export interface CompassResult {
  dimensionScores: CompassDimensionResult[];
  // The MIN across all six dimension scores — one absent dimension caps
  // the whole account's stage, even if every other dimension is strong.
  overallScore: LadderValue;
  stage: CompassStage;
  // Which dimension(s) are holding the account back from Established —
  // empty when stage is "established". The lowest-scoring dimension(s),
  // in ANCHOR_DIMENSIONS order.
  gatingDimensions: AnchorDimension[];
  // A separate 0-100 weighted average across dimension scores, for
  // quarter-over-quarter trend tracking ONLY — never substitutes for the
  // gate above, and must always be shown alongside the stage so it can't
  // read as contradicting it (e.g. "Index 61 · Emerging — capped by
  // Authority").
  index: number;
}

/**
 * A dimension with no answered questions scores 0 (Absent) rather than
 * throwing — an incomplete assessment should never crash the engine, it
 * should just read as "not established yet," which is the honest state.
 */
export function computeDimensionScore(answers: readonly CompassAnswerInput[], dimension: AnchorDimension): CompassDimensionResult {
  const relevant = answers.filter((a) => a.dimension === dimension);
  if (relevant.length === 0) return { dimension, score: 0, answerCount: 0 };
  const score = Math.min(...relevant.map((a) => a.value)) as LadderValue;
  return { dimension, score, answerCount: relevant.length };
}

export function computeCompassResult(answers: readonly CompassAnswerInput[]): CompassResult {
  const dimensionScores = ANCHOR_DIMENSIONS.map((dimension) => computeDimensionScore(answers, dimension));
  const overallScore = Math.min(...dimensionScores.map((d) => d.score)) as LadderValue;
  const stage: CompassStage = overallScore >= COMPASS_ESTABLISHED_THRESHOLD ? "established" : "emerging";
  const gatingDimensions =
    stage === "emerging" ? dimensionScores.filter((d) => d.score < COMPASS_ESTABLISHED_THRESHOLD).map((d) => d.dimension) : [];
  const maxPossible = dimensionScores.length * 3;
  const index = maxPossible > 0 ? Math.round((dimensionScores.reduce((sum, d) => sum + d.score, 0) / maxPossible) * 100) : 0;

  return { dimensionScores, overallScore, stage, gatingDimensions, index };
}
