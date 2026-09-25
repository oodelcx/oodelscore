import { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { User } from "../models/User";
import { Response } from "../models/Response";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { Playbook } from "../models/Playbook";
import { DecisionLogEntry } from "../models/DecisionLogEntry";
import { CxPulsePulseResponse } from "../models/CxPulsePulseResponse";
import { CxPulseFramework, CX_PULSE_FRAMEWORK_SINGLETON_KEY } from "../models/CxPulseFramework";
import { CxPulseScore, type CxPulseLevel, type ICxPulseDimensions } from "../models/CxPulseScore";
import { BillingOwnerType } from "../models/BillingSubscription";
import { hasProduct, type Product } from "../models/products";

const DEFAULT_WEIGHTS: ICxPulseDimensions = { awareness: 20, response: 25, ownership: 20, culture: 15, outcome: 20 };
const RESPONSE_WINDOW_DAYS = 30;
const RESPONSE_LINK_WINDOW_HOURS = 48;
const AWARENESS_DECAY_DAYS = 60;

/** Spec Section 7: composite -> level bands. */
export function levelFromComposite(score: number): CxPulseLevel {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

export async function getCxPulseFrameworkOrDefault() {
  const existing = await CxPulseFramework.findOne({ singletonKey: CX_PULSE_FRAMEWORK_SINGLETON_KEY });
  if (existing) return existing;
  return CxPulseFramework.create({
    singletonKey: CX_PULSE_FRAMEWORK_SINGLETON_KEY,
    weights: DEFAULT_WEIGHTS,
    pulseQuestions: [],
  });
}

function currentQuarterLabel(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

function isNegativeAnswer(answer: { type: string; value: unknown }): boolean {
  if (answer.type === "star_1_5" && typeof answer.value === "number") return answer.value <= 2;
  if (answer.type === "nps_0_10" && typeof answer.value === "number") return answer.value <= 6;
  return false;
}

/**
 * Awareness: spec says "Insights report open/view rate; login frequency of
 * business/group managers." AI Insights view-tracking doesn't exist yet, so
 * this uses login recency as a proxy (the one signal we actually have —
 * users.lastLoginAt) — a full day-0 login scores 100, decaying to 0 by
 * AWARENESS_DECAY_DAYS with no login. Revisit once report view-tracking ships.
 */
async function awarenessScore(userIds: Types.ObjectId[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const users = await User.find({ _id: { $in: userIds } }).select("lastLoginAt");
  const now = Date.now();
  const scores = users.map((u) => {
    if (!u.lastLoginAt) return 0;
    const days = (now - u.lastLoginAt.getTime()) / (24 * 60 * 60 * 1000);
    return Math.max(0, Math.min(100, 100 - days * (100 / AWARENESS_DECAY_DAYS)));
  });
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length);
}

/** % of flagged/negative responses with a linked actionBoardItem created within 48h. */
async function responseScore(businessIds: Types.ObjectId[], from: Date, to: Date, product: Product): Promise<number> {
  if (businessIds.length === 0) return 0;
  const responses = await Response.find({ businessId: { $in: businessIds }, product, submittedAt: { $gte: from, $lte: to } });
  const negative = responses.filter((r) => r.answers.some(isNegativeAnswer));
  if (negative.length === 0) return 100; // nothing negative to have missed responding to

  const negativeIds = negative.map((r) => r._id);
  const actionItems = await ActionBoardItem.find({
    businessId: { $in: businessIds },
    product,
    sourceResponseIds: { $in: negativeIds },
  }).select("sourceResponseIds createdAt");

  let respondedCount = 0;
  for (const response of negative) {
    const linked = actionItems.some(
      (item) =>
        item.sourceResponseIds.some((id) => id.equals(response._id)) &&
        item.createdAt.getTime() - response.submittedAt.getTime() <= RESPONSE_LINK_WINDOW_HOURS * 60 * 60 * 1000
    );
    if (linked) respondedCount++;
  }
  return Math.round((respondedCount / negative.length) * 100);
}

/** % of actionBoardItems with a non-null ownerId — Action Board is Group-only, so this is 0 for a standalone business. */
async function ownershipScore(businessIds: Types.ObjectId[], product: Product): Promise<number> {
  if (businessIds.length === 0) return 0;
  const items = await ActionBoardItem.find({ businessId: { $in: businessIds }, product }).select("ownerId");
  if (items.length === 0) return 0;
  const owned = items.filter((i) => i.ownerId !== null).length;
  return Math.round((owned / items.length) * 100);
}

/**
 * Playbook adoption rate relative to flagged items (Group-level only —
 * playbooks aren't tied to a single standalone business) blended with
 * whether this quarter's self-assessment was answered.
 */
async function cultureScore(
  parentOrgId: Types.ObjectId | null,
  businessIds: Types.ObjectId[],
  quarter: string,
  product: Product
): Promise<number> {
  let playbookRate: number | null = null;
  if (parentOrgId) {
    const playbooks = await Playbook.find({ parentOrgId, product }).select("usageCount");
    const totalUsage = playbooks.reduce((sum, p) => sum + p.usageCount, 0);
    const from = new Date(Date.now() - RESPONSE_WINDOW_DAYS * 3 * 24 * 60 * 60 * 1000); // ~90 days
    const recentResponses = await Response.find({ businessId: { $in: businessIds }, product, submittedAt: { $gte: from } }).select(
      "answers"
    );
    const flaggedCount = recentResponses.filter((r) => r.answers.some(isNegativeAnswer)).length;
    playbookRate = flaggedCount > 0 ? Math.min(100, Math.round((totalUsage / flaggedCount) * 100)) : totalUsage > 0 ? 100 : 0;
  }

  // The quarterly self-assessment (CxPulsePulseResponse) is Customer
  // Experience's own questionnaire — Colleague Experience has no equivalent
  // yet, so its culture score is playbook adoption alone rather than a
  // blend. Revisit if/when a CE-specific self-assessment is built.
  let selfAssessmentScore = 0;
  if (product === "customer_experience") {
    const ownerType: BillingOwnerType = parentOrgId ? "parentOrg" : "business";
    const ownerId = parentOrgId ?? businessIds[0];
    const selfAssessment = ownerId ? await CxPulsePulseResponse.findOne({ ownerType, ownerId, quarter }) : null;
    selfAssessmentScore = selfAssessment && selfAssessment.answers.length > 0 ? 100 : 0;
  }

  if (playbookRate === null) return selfAssessmentScore;
  if (product !== "customer_experience") return playbookRate;
  return Math.round((playbookRate + selfAssessmentScore) / 2);
}

/** % of decisionLogEntries with outcomeAfter showing a confirmed positive delta vs outcomeBefore. */
async function outcomeScore(businessIds: Types.ObjectId[], product: Product): Promise<number> {
  if (businessIds.length === 0) return 0;
  const entries = await DecisionLogEntry.find({
    affectedBusinessIds: { $in: businessIds },
    product,
    outcomeBefore: { $ne: null },
    outcomeAfter: { $ne: null },
  }).select("outcomeBefore outcomeAfter");
  if (entries.length === 0) return 0;
  const positive = entries.filter((e) => (e.outcomeAfter as number) > (e.outcomeBefore as number)).length;
  return Math.round((positive / entries.length) * 100);
}

/**
 * eNPS = %promoters (9-10) - %detractors (0-6) on the nps_0_10 question,
 * over the same rolling response window as the rest of the ladder.
 * Colleague Experience's standing headline metric (never computed for
 * customer_experience — CX has its own NPS reporting elsewhere).
 */
async function computeENPS(businessIds: Types.ObjectId[], from: Date, to: Date): Promise<number | null> {
  if (businessIds.length === 0) return null;
  const responses = await Response.find({
    businessId: { $in: businessIds },
    product: "colleague_experience",
    submittedAt: { $gte: from, $lte: to },
  }).select("answers");

  const scores: number[] = [];
  for (const response of responses) {
    for (const answer of response.answers) {
      if (answer.type === "nps_0_10" && typeof answer.value === "number") scores.push(answer.value);
    }
  }
  if (scores.length === 0) return null;

  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

export interface CxPulseResult {
  dimensions: ICxPulseDimensions;
  compositeScore: number;
  level: CxPulseLevel;
  enps: number | null;
}

/**
 * Computes one owner's current CX (or, with product: "colleague_experience",
 * EX) Pulse score. Never call this from a page request (spec Section 7) —
 * it fans out across responses, action items, playbooks, and decision log
 * entries. Call only from the nightly job below.
 */
export async function computeCxPulseForOwner(
  ownerType: BillingOwnerType,
  ownerId: Types.ObjectId,
  product: Product = "customer_experience"
): Promise<CxPulseResult> {
  const framework = await getCxPulseFrameworkOrDefault();

  let businessIds: Types.ObjectId[];
  let userIds: Types.ObjectId[];
  let parentOrgIdForCulture: Types.ObjectId | null;

  if (ownerType === "business") {
    businessIds = [ownerId];
    const owner = await User.findOne({ accountType: "business", parentId: ownerId }).select("_id");
    userIds = owner ? [owner._id] : [];
    parentOrgIdForCulture = null;
  } else {
    const businesses = await Business.find({ parentOrgId: ownerId }).select("_id");
    businessIds = businesses.map((b) => b._id);
    const businessOwners = await User.find({ accountType: "business", parentId: { $in: businessIds } }).select("_id");
    const orgOwner = await User.findOne({ accountType: "parent_org", parentId: ownerId }).select("_id");
    userIds = [...(orgOwner ? [orgOwner._id] : []), ...businessOwners.map((u) => u._id)];
    parentOrgIdForCulture = ownerId;
  }

  const now = new Date();
  const from = new Date(now.getTime() - RESPONSE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const dimensions: ICxPulseDimensions = {
    awareness: await awarenessScore(userIds),
    response: await responseScore(businessIds, from, now, product),
    ownership: await ownershipScore(businessIds, product),
    culture: await cultureScore(parentOrgIdForCulture, businessIds, currentQuarterLabel(now), product),
    outcome: await outcomeScore(businessIds, product),
  };

  const compositeScore = Math.round(
    (dimensions.awareness * framework.weights.awareness +
      dimensions.response * framework.weights.response +
      dimensions.ownership * framework.weights.ownership +
      dimensions.culture * framework.weights.culture +
      dimensions.outcome * framework.weights.outcome) /
      100
  );

  const enps = product === "colleague_experience" ? await computeENPS(businessIds, from, now) : null;

  return { dimensions, compositeScore, level: levelFromComposite(compositeScore), enps };
}

export interface CxPulseRecomputeResult {
  businessesScored: number;
  parentOrgsScored: number;
  ceBusinessesScored: number;
  ceParentOrgsScored: number;
  /** The month the scores were written against, as an ISO date. */
  period: string;
}

/**
 * Nightly job (spec Section 10a). Recomputes every business and parent
 * org's CX Pulse score for the current month, plus an EX Pulse score
 * (product: "colleague_experience") for whichever ones actually have
 * Colleague Experience enabled — no point writing a dormant, all-zero row
 * for every account that hasn't bought the product.
 */
export async function recomputeAllCxPulseScores(): Promise<CxPulseRecomputeResult> {
  const now = new Date();
  const period = new Date(now.getFullYear(), now.getMonth(), 1);

  const businesses = await Business.find({ active: true }).select("_id enabledProducts");
  let ceBusinessesScored = 0;
  for (const business of businesses) {
    const result = await computeCxPulseForOwner("business", business._id, "customer_experience");
    await CxPulseScore.findOneAndUpdate(
      { ownerType: "business", ownerId: business._id, period, product: "customer_experience" },
      { $set: result },
      { upsert: true }
    );

    if (hasProduct(business, "colleague_experience")) {
      const ceResult = await computeCxPulseForOwner("business", business._id, "colleague_experience");
      await CxPulseScore.findOneAndUpdate(
        { ownerType: "business", ownerId: business._id, period, product: "colleague_experience" },
        { $set: ceResult },
        { upsert: true }
      );
      ceBusinessesScored++;
    }
  }

  const parentOrgs = await ParentOrganization.find().select("_id enabledProducts");
  let ceParentOrgsScored = 0;
  for (const org of parentOrgs) {
    const result = await computeCxPulseForOwner("parentOrg", org._id, "customer_experience");
    await CxPulseScore.findOneAndUpdate(
      { ownerType: "parentOrg", ownerId: org._id, period, product: "customer_experience" },
      { $set: result },
      { upsert: true }
    );

    if (hasProduct(org, "colleague_experience")) {
      const ceResult = await computeCxPulseForOwner("parentOrg", org._id, "colleague_experience");
      await CxPulseScore.findOneAndUpdate(
        { ownerType: "parentOrg", ownerId: org._id, period, product: "colleague_experience" },
        { $set: ceResult },
        { upsert: true }
      );
      ceParentOrgsScored++;
    }
  }

  return {
    businessesScored: businesses.length,
    parentOrgsScored: parentOrgs.length,
    ceBusinessesScored,
    ceParentOrgsScored,
    period: period.toISOString(),
  };
}
