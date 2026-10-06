import { Types } from "mongoose";
import type { BillingOwnerType } from "../models/BillingSubscription";
import type { Product } from "../models/products";
import { Business } from "../models/Business";
import { User } from "../models/User";
import { CxGoal } from "../models/CxGoal";
import { DecisionLogEntry } from "../models/DecisionLogEntry";
import { CategoryOwnerMapping } from "../models/CategoryOwnerMapping";
import { RecurringIssueFlag } from "../models/RecurringIssueFlag";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { ClosingLoopUpdate } from "../models/ClosingLoopUpdate";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { Response as FeedbackResponse } from "../models/Response";
import { AlertRule } from "../models/AlertRule";
import { CxPulsePulseResponse } from "../models/CxPulsePulseResponse";
import { ANCHOR_DIMENSIONS, type AnchorDimension } from "./questionBank";
import type { LadderValue } from "./scoring";
import { currentQuarterLabel, selfAssessmentOwnerFor } from "../cxpulse/selfAssessment";

/**
 * Evidence Fusion (PRODUCT-ROADMAP.md Phase 8) — "Compass assessment
 * answers vs. real product activity." Compass's dimension scores are
 * entirely self-reported (someone picks a rung on a ladder); this module
 * cross-checks each of those six self-reports against real, already-computed
 * activity signals elsewhere in the platform, so a confident self-score
 * with no activity behind it gets surfaced, not taken at face value.
 *
 * Deliberately NOT retroactive: this only ever compares TODAY's real
 * activity against the CURRENT completed assessment (never against
 * CompassAssessmentHistory rows) — past real-world activity state can't be
 * reconstructed, so there is nothing honest to compare an old self-report
 * against. The retake history (CompassAssessmentHistory) already shows how
 * the self-report itself has moved over time; this adds a live reality
 * check on top of the assessment that's in force right now.
 *
 * Each dimension gets exactly 3 binary (met / not met) indicators, chosen
 * from signals the platform already computes for other features, so the
 * evidence score lands on the same 0-3 ladder as the self-report and the
 * two numbers are directly comparable.
 */

export type EvidenceStatus = "confirmed" | "overstated" | "understated" | "insufficient_data";

export interface EvidenceIndicator {
  key: string;
  label: string;
  met: boolean;
}

export interface DimensionEvidence {
  dimension: AnchorDimension;
  selfScore: LadderValue;
  evidenceScore: LadderValue;
  indicators: EvidenceIndicator[];
  status: EvidenceStatus;
}

export interface EvidenceFusionResult {
  dimensions: DimensionEvidence[];
  computedAt: Date;
}

const RESPONSE_WINDOW_DAYS = 30;
const CLOSING_LOOP_WINDOW_DAYS = 90;
const LOGIN_RECENCY_DAYS = 14;

interface OwnerScope {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  businessIds: Types.ObjectId[];
  userIds: Types.ObjectId[];
}

/**
 * Same business/user scope resolution cxpulse/compute.ts's
 * computeCxPulseForOwner() already uses — kept consistent so "this owner's
 * own activity" means the same set of businesses/logins everywhere on the
 * platform, not a second, subtly different definition.
 */
async function resolveOwnerScope(ownerType: BillingOwnerType, ownerId: Types.ObjectId): Promise<OwnerScope> {
  if (ownerType === "business") {
    const owner = await User.findOne({ accountType: "business", parentId: ownerId }).select("_id");
    return { ownerType, ownerId, businessIds: [ownerId], userIds: owner ? [owner._id] : [] };
  }
  const businesses = await Business.find({ parentOrgId: ownerId }).select("_id");
  const businessIds = businesses.map((b) => b._id);
  const businessOwners = await User.find({ accountType: "business", parentId: { $in: businessIds } }).select("_id");
  const orgOwner = await User.findOne({ accountType: "parent_org", parentId: ownerId }).select("_id");
  const userIds = [...(orgOwner ? [orgOwner._id] : []), ...businessOwners.map((u) => u._id)];
  return { ownerType, ownerId, businessIds, userIds };
}

async function authorityIndicators(scope: OwnerScope): Promise<EvidenceIndicator[]> {
  const [goalCount, recentLoginCount, ownedDecisionCount] = await Promise.all([
    CxGoal.countDocuments({ ownerType: scope.ownerType, ownerId: scope.ownerId, status: "active" }),
    scope.userIds.length === 0
      ? Promise.resolve(0)
      : User.countDocuments({
          _id: { $in: scope.userIds },
          lastLoginAt: { $gte: new Date(Date.now() - LOGIN_RECENCY_DAYS * 24 * 60 * 60 * 1000) },
        }),
    DecisionLogEntry.countDocuments({
      ...decisionLogOwnerFilter(scope),
      ownerId: { $ne: null },
      status: { $ne: "planned" },
    }),
  ]);
  return [
    { key: "goal_set", label: "A formal CX/EX goal is active", met: goalCount > 0 },
    { key: "owner_logged_in", label: "The account owner has logged in recently", met: recentLoginCount > 0 },
    { key: "decision_owned", label: "A logged decision has a named owner and isn't just “planned”", met: ownedDecisionCount > 0 },
  ];
}

function decisionLogOwnerFilter(scope: OwnerScope) {
  return scope.ownerType === "business" ? { businessId: scope.ownerId } : { parentOrgId: scope.ownerId };
}

async function numbersIndicators(scope: OwnerScope): Promise<EvidenceIndicator[]> {
  const businessesWithInputs =
    scope.businessIds.length === 0
      ? 0
      : await Business.countDocuments({
          _id: { $in: scope.businessIds },
          "businessValueInputs.avgTransactionValue": { $ne: null },
          "businessValueInputs.visitsPerYear": { $ne: null },
        });
  const [measuredCount, positiveOutcomeCount] = await Promise.all([
    DecisionLogEntry.countDocuments({ ...decisionLogOwnerFilter(scope), outcomeMeasuredAt: { $ne: null } }),
    DecisionLogEntry.countDocuments({
      ...decisionLogOwnerFilter(scope),
      outcomeBefore: { $ne: null },
      outcomeAfter: { $ne: null },
      $expr: { $ne: ["$outcomeBefore", "$outcomeAfter"] },
    }),
  ]);
  return [
    { key: "bv_inputs_set", label: "Business Value inputs are filled in", met: businessesWithInputs > 0 },
    { key: "outcome_measured", label: "A decision's outcome has actually been measured", met: measuredCount > 0 },
    { key: "outcome_moved", label: "A measured outcome shows real movement, not just a plan", met: positiveOutcomeCount > 0 },
  ];
}

async function cultureIndicators(scope: OwnerScope, product: Product): Promise<EvidenceIndicator[]> {
  const [selfAssessmentAnswered, closingLoopCount, categoryOwnerCount] = await Promise.all([
    selfAssessmentAnsweredThisQuarter(scope, product),
    ClosingLoopUpdate.countDocuments({
      ...closingLoopOwnerFilter(scope),
      status: "sent",
      sentAt: { $gte: new Date(Date.now() - CLOSING_LOOP_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
    }),
    CategoryOwnerMapping.countDocuments({ ownerScope: scope.ownerType, ownerScopeId: scope.ownerId }),
  ]);
  return [
    { key: "self_assessment_current", label: "The quarterly culture self-assessment is answered", met: selfAssessmentAnswered },
    { key: "closing_loop_sent", label: "A “you said, we did” update has gone out recently", met: closingLoopCount > 0 },
    { key: "category_owners_set", label: "At least one category has a default owner configured", met: categoryOwnerCount > 0 },
  ];
}

function closingLoopOwnerFilter(scope: OwnerScope) {
  return scope.ownerType === "business" ? { businessId: scope.ownerId } : { parentOrgId: scope.ownerId };
}

/**
 * Reuses the exact ownership rule cultureScore() already applies: a branch
 * never answers its own quarterly self-assessment, its parent org does —
 * so for a branch owner this checks the PARENT ORG's answer, same as the
 * CX Pulse Culture dimension itself does.
 */
async function selfAssessmentAnsweredThisQuarter(scope: OwnerScope, product: Product): Promise<boolean> {
  let ownerType: BillingOwnerType = scope.ownerType;
  let ownerId = scope.ownerId;
  if (scope.ownerType === "business") {
    const business = await Business.findById(scope.ownerId).select("parentOrgId");
    const owner = business ? selfAssessmentOwnerFor(business) : null;
    if (owner) {
      ownerType = owner.ownerType;
      ownerId = owner.ownerId;
    }
  }
  const response = await CxPulsePulseResponse.findOne({ ownerType, ownerId, product, quarter: currentQuarterLabel() }).select("answers");
  return !!response && response.answers.some((a) => a.answer.trim().length > 0);
}

async function hearingIndicators(scope: OwnerScope, product: Product): Promise<EvidenceIndicator[]> {
  if (scope.businessIds.length === 0) {
    return [
      { key: "feedback_point_active", label: "At least one feedback point is live", met: false },
      { key: "responses_recent", label: "Customers/colleagues have responded in the last 30 days", met: false },
      { key: "alert_rule_set", label: "An alert rule is listening for this account", met: false },
    ];
  }
  const [activePointCount, recentResponseCount, alertRuleCount] = await Promise.all([
    FeedbackPoint.countDocuments({ businessId: { $in: scope.businessIds }, active: true }),
    FeedbackResponse.countDocuments({
      businessId: { $in: scope.businessIds },
      product,
      submittedAt: { $gte: new Date(Date.now() - RESPONSE_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
    }),
    AlertRule.countDocuments({ ownerId: scope.ownerId }),
  ]);
  return [
    { key: "feedback_point_active", label: "At least one feedback point is live", met: activePointCount > 0 },
    { key: "responses_recent", label: "Customers/colleagues have responded in the last 30 days", met: recentResponseCount > 0 },
    { key: "alert_rule_set", label: "An alert rule is listening for this account", met: alertRuleCount > 0 },
  ];
}

async function ownershipIndicators(scope: OwnerScope, product: Product): Promise<EvidenceIndicator[]> {
  const [categoryOwnerCount, items, resolvedWithNoteCount] = await Promise.all([
    CategoryOwnerMapping.countDocuments({ ownerScope: scope.ownerType, ownerScopeId: scope.ownerId }),
    scope.businessIds.length === 0
      ? Promise.resolve([])
      : ActionBoardItem.find({ businessId: { $in: scope.businessIds }, product }).select("ownerId"),
    scope.businessIds.length === 0
      ? Promise.resolve(0)
      : ActionBoardItem.countDocuments({
          businessId: { $in: scope.businessIds },
          product,
          status: "resolved",
          resolutionNote: { $ne: "" },
        }),
  ]);
  const ownershipRate = items.length === 0 ? 0 : items.filter((i) => i.ownerId !== null).length / items.length;
  return [
    { key: "category_owners_set", label: "At least one category has a default owner configured", met: categoryOwnerCount > 0 },
    { key: "ownership_rate", label: "At least half of all cases have a named owner", met: ownershipRate >= 0.5 },
    { key: "resolutions_documented", label: "A resolved case has an actual resolution note on it", met: resolvedWithNoteCount > 0 },
  ];
}

async function rhythmIndicators(scope: OwnerScope): Promise<EvidenceIndicator[]> {
  const filter = { ownerScope: scope.ownerType, ownerScopeId: scope.ownerId };
  const [flagCount, convertedCount, implementedDecisionCount] = await Promise.all([
    RecurringIssueFlag.countDocuments(filter),
    RecurringIssueFlag.countDocuments({ ...filter, status: "converted" }),
    DecisionLogEntry.countDocuments({ ...decisionLogOwnerFilter(scope), implementationDate: { $ne: null } }),
  ]);
  return [
    { key: "recurring_flag_raised", label: "A recurring-issue pattern has ever been flagged", met: flagCount > 0 },
    { key: "recurring_flag_converted", label: "A flagged pattern was converted into real follow-through", met: convertedCount > 0 },
    { key: "decision_implemented", label: "A logged decision has an actual implementation date", met: implementedDecisionCount > 0 },
  ];
}

const INDICATOR_RESOLVERS: Record<AnchorDimension, (scope: OwnerScope, product: Product) => Promise<EvidenceIndicator[]>> = {
  authority: (scope) => authorityIndicators(scope),
  numbers: (scope) => numbersIndicators(scope),
  culture: (scope, product) => cultureIndicators(scope, product),
  hearing: (scope, product) => hearingIndicators(scope, product),
  ownership: (scope, product) => ownershipIndicators(scope, product),
  rhythm: (scope) => rhythmIndicators(scope),
};

export function statusFor(selfScore: LadderValue, evidenceScore: LadderValue, hasAnyActivity: boolean): EvidenceStatus {
  if (!hasAnyActivity) return "insufficient_data";
  if (selfScore >= evidenceScore + 2) return "overstated";
  if (evidenceScore >= selfScore + 2) return "understated";
  return "confirmed";
}

/**
 * Computes evidence for every ANCHOR dimension against the account's
 * CURRENT self-reported Compass dimension scores. Intended to be called
 * live from the Compass results view (cheap: a handful of counts, not a
 * nightly job like CX Pulse) — only ever runs when the assessment is
 * already "completed," so there is always a self-score to compare against.
 *
 * `dualProductCombine`: for an account with both products enabled, an
 * indicator counts as met if it's true for EITHER product on dimensions
 * that aren't product-specific by nature (hearing/ownership check both
 * products' own activity; culture/numbers use the dimension's own
 * product-aware self-assessment/decision data). This is a documented
 * simplification, not an attempt to blend two separate evidence trails.
 */
export async function computeEvidenceFusion(
  ownerType: BillingOwnerType,
  ownerId: Types.ObjectId,
  dimensionScores: { dimension: AnchorDimension; score: LadderValue }[],
  products: readonly Product[]
): Promise<EvidenceFusionResult> {
  const scope = await resolveOwnerScope(ownerType, ownerId);
  const primaryProduct = products[0] ?? "customer_experience";

  const dimensions: DimensionEvidence[] = await Promise.all(
    ANCHOR_DIMENSIONS.map(async (dimension) => {
      const selfEntry = dimensionScores.find((d) => d.dimension === dimension);
      const selfScore: LadderValue = selfEntry?.score ?? 0;

      const perProductIndicators = await Promise.all(products.map((product) => INDICATOR_RESOLVERS[dimension](scope, product)));
      const indicators: EvidenceIndicator[] =
        perProductIndicators.length <= 1
          ? (perProductIndicators[0] ?? (await INDICATOR_RESOLVERS[dimension](scope, primaryProduct)))
          : perProductIndicators[0].map((ind, i) => ({
              ...ind,
              met: perProductIndicators.some((set) => set[i]?.met),
            }));

      const evidenceScore = indicators.filter((i) => i.met).length as LadderValue;
      const hasAnyActivity = indicators.some((i) => i.met);

      return {
        dimension,
        selfScore,
        evidenceScore,
        indicators,
        status: statusFor(selfScore, evidenceScore, hasAnyActivity),
      };
    })
  );

  return { dimensions, computedAt: new Date() };
}
