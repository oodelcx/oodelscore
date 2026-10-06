import type { Types } from "mongoose";
import { CompassAssessment } from "../models/CompassAssessment";
import { CompassAssessmentHistory } from "../models/CompassAssessmentHistory";
import { PlatformSettings, PLATFORM_SETTINGS_SINGLETON_KEY } from "../models/PlatformSettings";
import type { BillingOwnerType } from "../models/BillingSubscription";
import type { Product } from "../models/products";
import { ANCHOR_DIMENSIONS, questionsForProducts, type AnchorDimension } from "../compass/questionBank";
import { computeCompassResult, type LadderValue } from "../compass/scoring";
import { computeEvidenceFusion, statusFor } from "../compass/evidenceFusion";

/**
 * Demo Compass history for the showcase accounts.
 *
 * Every account gets a current, completed assessment plus earlier retakes
 * that show progress over the last year and a half. The current assessment's
 * "evidence" is computed live from the activity the showcase seed has just
 * created, then each dimension's self-score is chosen relative to it so the
 * demo shows a deliberate mix of confirmed, overstated and understated
 * results. The evidence snapshots on the EARLIER retakes are illustrative
 * (past activity can't be reconstructed): they are written to show the
 * intended story of a claim and its proof moving together over time.
 */

export interface CompassDemoOwner {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  name: string;
  industry: string;
  products: readonly Product[];
  /** Full profile for group/standalone accounts; branches get a lighter, name-derived one. */
  profile?: CompassDemoProfile;
}

export interface CompassDemoProfile {
  /** One letter per ANCHOR dimension (authority, numbers, culture, hearing, ownership, rhythm):
   * c = self-score matches activity, o = self-score runs ahead of activity, u = activity runs ahead of the self-score. */
  pattern: string;
  stage: "established" | "emerging";
  /** For an emerging account, the dimension(s) held low so the stage is visibly capped by it. */
  capped?: Partial<Record<AnchorDimension, LadderValue>>;
  /** Earlier retakes to create. */
  retakes: number;
  /** How long ago the current assessment was completed; past the platform cadence it shows as due. */
  currentDaysAgo: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const clamp = (n: number): LadderValue => Math.max(0, Math.min(3, Math.round(n))) as LadderValue;

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** A light, deterministic profile for a branch, so branches differ from each other without hand-writing 23 of them. */
export function branchProfile(name: string): CompassDemoProfile {
  const h = hash(name);
  const emerging = h % 3 === 0;
  const letters = ["c", "c", "c", "c", "c", "c"];
  letters[h % 6] = h % 2 === 0 ? "o" : "u";
  return {
    pattern: letters.join(""),
    stage: emerging ? "emerging" : "established",
    capped: emerging ? { [ANCHOR_DIMENSIONS[(h >> 3) % 6]]: 1 } : undefined,
    retakes: 1,
    currentDaysAgo: 25 + (h % 50),
  };
}

function targetFor(pattern: string, index: number, evidence: LadderValue): LadderValue {
  const letter = pattern[index] ?? "c";
  if (letter === "o") return evidence <= 1 ? clamp(evidence + 2) : clamp(evidence + 1);
  if (letter === "u") return evidence >= 2 ? clamp(evidence - 2) : clamp(evidence - 1);
  return clamp(evidence + (index % 2 === 0 ? 0 : 1) - (evidence === 3 ? 1 : 0));
}

/** Seeds one account. Returns how many history rows it wrote. */
async function seedOne(owner: CompassDemoOwner, now: Date): Promise<number> {
  const profile = owner.profile ?? branchProfile(owner.name);
  const defs = await questionsForProducts(owner.products);
  if (defs.length === 0) return 0;

  // 1. Live evidence from the real activity just seeded (self-scores are irrelevant to the evidence itself).
  const probe = await computeEvidenceFusion(
    owner.ownerType,
    owner.ownerId,
    ANCHOR_DIMENSIONS.map((dimension) => ({ dimension, score: 0 as LadderValue })),
    owner.products
  );
  const evidenceOf = (d: AnchorDimension): LadderValue => probe.dimensions.find((x) => x.dimension === d)?.evidenceScore ?? 0;

  // 2. Choose the self-scores (the claim) relative to that evidence, then shape them to the account's stage.
  const target: Record<string, LadderValue> = {};
  ANCHOR_DIMENSIONS.forEach((d, i) => {
    let value = targetFor(profile.pattern, i, evidenceOf(d));
    if (profile.stage === "established") value = clamp(Math.max(value, 2));
    const cap = profile.capped?.[d];
    if (profile.stage === "emerging" && cap !== undefined) value = cap;
    target[d] = value;
  });
  if (profile.stage === "emerging" && !ANCHOR_DIMENSIONS.some((d) => target[d] < 2)) target[ANCHOR_DIMENSIONS[5]] = 1;

  // 3. Answers: one question per dimension sits exactly on the target (the weakest answer sets the score), the rest at or above it.
  const seenInDimension = new Map<string, number>();
  const answers = defs.map((q) => {
    const n = seenInDimension.get(q.dimension) ?? 0;
    seenInDimension.set(q.dimension, n + 1);
    const base = target[q.dimension];
    const value = clamp(n === 0 ? base : base + (hash(q.key) % 2));
    return { questionKey: q.key, dimension: q.dimension, value: value as LadderValue, questionText: q.text };
  });
  const result = computeCompassResult(answers);

  // 4. The evidence snapshot stored with the current assessment: real evidence, status judged against the final self-scores.
  const evidence = probe.dimensions.map((d) => {
    const selfScore = result.dimensionScores.find((x) => x.dimension === d.dimension)?.score ?? 0;
    return {
      dimension: d.dimension,
      selfScore,
      evidenceScore: d.evidenceScore,
      status: statusFor(selfScore, d.evidenceScore, d.indicators.some((i) => i.met)),
    };
  });

  const completedAt = new Date(now.getTime() - profile.currentDaysAgo * DAY_MS);
  await CompassAssessmentHistory.deleteMany({ ownerType: owner.ownerType, ownerId: owner.ownerId });
  await CompassAssessment.findOneAndUpdate(
    { ownerType: owner.ownerType, ownerId: owner.ownerId },
    {
      $set: {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        industry: owner.industry,
        status: "completed",
        answers,
        dimensionScores: result.dimensionScores.map((d) => ({ dimension: d.dimension, score: d.score })),
        overallScore: result.overallScore,
        stage: result.stage,
        gatingDimensions: result.gatingDimensions,
        index: result.index,
        evidence,
        completedAt,
      },
    },
    { upsert: true, new: true }
  );

  // 5. Earlier retakes, oldest first: both the claim and the proof climb toward today's picture.
  const currentSelf = Object.fromEntries(result.dimensionScores.map((d) => [d.dimension, d.score])) as Record<string, number>;
  const currentEvidence = Object.fromEntries(probe.dimensions.map((d) => [d.dimension, d.evidenceScore])) as Record<string, number>;
  const spacingDays = 135;
  const k = profile.retakes;
  for (let i = 0; i < k; i++) {
    const stepsBack = k - i;
    const at = new Date(completedAt.getTime() - stepsBack * spacingDays * DAY_MS);
    const histSelf = ANCHOR_DIMENSIONS.map((d, di) => {
      const stride = [1, 0.7, 0.5, 0.8, 0.6, 0.9][di];
      return { dimension: d, score: clamp(currentSelf[d] - stepsBack * stride) };
    });
    const histResult = computeCompassResult(histSelf.map((d) => ({ questionKey: `demo-${d.dimension}`, dimension: d.dimension, value: d.score })));
    const histEvidence = ANCHOR_DIMENSIONS.map((d) => {
      const selfScore = histSelf.find((x) => x.dimension === d)!.score;
      const evidenceScore = clamp(currentEvidence[d] - stepsBack * 0.7);
      return { dimension: d, selfScore, evidenceScore, status: statusFor(selfScore, evidenceScore, evidenceScore > 0 || selfScore === 0) };
    });
    await CompassAssessmentHistory.create({
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      industry: owner.industry,
      dimensionScores: histResult.dimensionScores.map((d) => ({ dimension: d.dimension, score: d.score })),
      overallScore: histResult.overallScore,
      stage: histResult.stage,
      gatingDimensions: histResult.gatingDimensions,
      index: histResult.index,
      evidence: histEvidence,
      completedAt: at,
      archivedAt: new Date(at.getTime() + 2 * DAY_MS),
    });
  }
  return k;
}

export interface CompassDemoResult {
  assessments: number;
  history: number;
}

export async function seedCompassDemo(owners: CompassDemoOwner[], now: Date = new Date()): Promise<CompassDemoResult> {
  // Re-assessment cadence (Admin-editable): only set when nobody has chosen one yet, so the "due" flag has something to measure against.
  const settings = await PlatformSettings.findOne({ singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY });
  if (!settings?.compassReassessmentCadenceDays) {
    await PlatformSettings.findOneAndUpdate(
      { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY },
      { $set: { compassReassessmentCadenceDays: 90 } },
      { upsert: true }
    );
  }

  let assessments = 0;
  let history = 0;
  for (const owner of owners) {
    try {
      const rows = await seedOne(owner, now);
      if (rows >= 0) assessments++;
      history += rows;
    } catch (err) {
      console.error(`[compass-demo] skipped ${owner.name}`, err);
    }
  }
  return { assessments, history };
}
