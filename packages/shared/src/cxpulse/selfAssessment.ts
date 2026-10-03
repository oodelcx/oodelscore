import { Types } from "mongoose";
import { CxPulsePulseResponse, type IPulseAnswer } from "../models/CxPulsePulseResponse";
import { getCxPulseFrameworkOrDefault } from "./compute";
import type { BillingOwnerType } from "../models/BillingSubscription";
import type { Product } from "../models/products";

/**
 * The quarterly CX Pulse self-assessment — a handful of questions an
 * account holder (or parent org, for a branch — see getCultureOwner below)
 * answers once per quarter, feeding the Culture dimension in
 * cxpulse/compute.ts. Each product has its own question set
 * (CxPulseFramework.pulseQuestions for Customer Experience,
 * .ceSelfAssessmentQuestions for Colleague Experience) and its own saved
 * answers (CxPulsePulseResponse, now keyed by product too).
 */
export function currentQuarterLabel(date: Date = new Date()): string {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${quarter}`;
}

export function pulseQuestionsFor(framework: { pulseQuestions: string[]; ceSelfAssessmentQuestions: string[] }, product: Product): string[] {
  return product === "colleague_experience" ? framework.ceSelfAssessmentQuestions : framework.pulseQuestions;
}

/**
 * Same ownership rule cultureScore() already applies: a branch (a business
 * with a parentOrgId) doesn't answer its own self-assessment — its parent
 * org does, once, for the whole network — same "one place decides"
 * pattern as the survey builder and Business Value inputs.
 */
export function selfAssessmentOwnerFor(business: { _id: Types.ObjectId; parentOrgId?: Types.ObjectId | null }): {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  editable: boolean;
} {
  if (business.parentOrgId) return { ownerType: "parentOrg", ownerId: business.parentOrgId, editable: false };
  return { ownerType: "business", ownerId: business._id, editable: true };
}

export interface SelfAssessmentView {
  quarter: string;
  questions: { question: string; answer: string }[];
  submittedAt: Date | null;
  editable: boolean;
}

export async function getSelfAssessment(
  ownerType: BillingOwnerType,
  ownerId: Types.ObjectId,
  product: Product,
  editable: boolean,
  quarter: string = currentQuarterLabel()
): Promise<SelfAssessmentView> {
  const framework = await getCxPulseFrameworkOrDefault();
  const questions = pulseQuestionsFor(framework, product);
  const existing = await CxPulsePulseResponse.findOne({ ownerType, ownerId, product, quarter });
  const answersByQuestion = new Map((existing?.answers ?? []).map((a) => [a.question, a.answer]));
  return {
    quarter,
    questions: questions.map((q) => ({ question: q, answer: answersByQuestion.get(q) ?? "" })),
    submittedAt: existing?.updatedAt ?? null,
    editable,
  };
}

const MAX_ANSWER_LENGTH = 2000;

export async function saveSelfAssessment(
  ownerType: BillingOwnerType,
  ownerId: Types.ObjectId,
  product: Product,
  answers: { question: string; answer: string }[],
  quarter: string = currentQuarterLabel()
) {
  const framework = await getCxPulseFrameworkOrDefault();
  const validQuestions = new Set(pulseQuestionsFor(framework, product));
  const cleaned: IPulseAnswer[] = answers
    .filter((a) => validQuestions.has(a.question) && typeof a.answer === "string")
    .map((a) => ({ question: a.question, answer: a.answer.slice(0, MAX_ANSWER_LENGTH) }));

  return CxPulsePulseResponse.findOneAndUpdate(
    { ownerType, ownerId, product, quarter },
    { $set: { answers: cleaned } },
    { upsert: true, new: true }
  );
}
