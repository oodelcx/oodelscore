import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import {
  AddressSchema,
  type IAddress,
  RagThresholdsSchema,
  type IRagThresholds,
  DEFAULT_RAG_THRESHOLDS,
  PricingTermsSchema,
  type IPricingTerms,
  DEFAULT_PRICING_TERMS,
  EscalationLevelSchema,
  type IEscalationLevel,
  DEFAULT_ESCALATION_LEVELS,
} from "./common";
import { PRODUCTS, type Product } from "./products";

export const BILLING_ASSIGNMENTS = ["group_pays", "branch_pays", "unassigned"] as const;
export type BillingAssignment = (typeof BILLING_ASSIGNMENTS)[number];

export const BUSINESS_PLANS = ["business_monthly", "business_yearly", "comp"] as const;
export type BusinessPlan = (typeof BUSINESS_PLANS)[number];

export const DEMOGRAPHIC_MODES = ["off", "optional", "mandatory"] as const;
export type DemographicMode = (typeof DEMOGRAPHIC_MODES)[number];

export interface IDemographicConfig {
  name: DemographicMode;
  email: DemographicMode;
  phone: DemographicMode;
  ageGroup: DemographicMode;
  gender: DemographicMode;
}

/**
 * Fields writable only by accountType "admin_staff" — see spec Section 2/4.
 * API routes MUST reject writes to these from Group/Business-level requests
 * even if present in the request body.
 */
export const BUSINESS_ADMIN_ONLY_FIELDS = [
  "billingAssignment",
  "demographicConfig",
  "questionTemplateId",
  "ragThresholds",
  "pricingTerms",
  "checkoutEnabled",
  "escalationLevels",
  "escalationSlaHours",
  "enabledFeatures",
  "paymentGateEnabled",
  "enabledProducts",
] as const;

export interface IBusiness {
  name: string;
  industry: string; // controlled vocabulary -> industries collection
  parentOrgId: Types.ObjectId | null; // null = standalone
  region: string; // only meaningful when parentOrgId set and org has regions
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: IAddress;
  billingAddressSameAsAddress: boolean;
  billingAssignment: BillingAssignment; // ADMIN-EDITABLE ONLY, ever
  // ADMIN-EDITABLE ONLY. What this business is actually charged, if it pays
  // for itself (billingAssignment "branch_pays" or a standalone business).
  // Meaningless for "group_pays" — the parent org's own pricingTerms covers
  // it instead, one subscription item per group_pays branch.
  pricingTerms: IPricingTerms;
  // Set only while billingAssignment is "group_pays" and the org has an
  // active Stripe subscription to attach to — the Stripe subscription item
  // ID covering this one branch on the org's single subscription. Lets
  // syncBranchGroupPaysCoverage() remove exactly this branch's line item
  // (and nothing else) the moment billingAssignment changes away from
  // "group_pays", without having to search Stripe for it.
  groupPaysStripeSubscriptionItemId: string;
  // ADMIN-EDITABLE ONLY. When true, this business's own billing page shows a
  // self-service "Continue to payment" link straight to Stripe Checkout.
  // Meaningless while billingAssignment is "group_pays" — that link lives on
  // the org's own billing page instead.
  checkoutEnabled: boolean;
  // ADMIN-EDITABLE ONLY. This business's own escalation chain — meaningful
  // whether or not it has a parent org (a standalone business still wants
  // "Owner -> Regional Support" for its own case types). When this business
  // belongs to a parent org, the org's own escalationLevels win instead
  // (same inheritance rule as ragThresholds) — this field only applies to a
  // standalone business, kept here rather than only on ParentOrganization so
  // a standalone business isn't stuck with the single default level forever.
  escalationLevels: IEscalationLevel[];
  // ADMIN-EDITABLE ONLY. Hours an unresolved case may sit at its current
  // escalation level before the cron auto-escalates it one level. null =
  // no auto-escalation (Admin/branch must escalate manually).
  escalationSlaHours: number | null;
  plan: BusinessPlan;
  maxFeedbackPoints: number;
  questionTemplateId: Types.ObjectId | null; // ADMIN-EDITABLE ONLY, ever
  demographicConfig: IDemographicConfig; // ADMIN-EDITABLE ONLY, ever
  accountManagerId: Types.ObjectId | null;
  teamMemberSeatLimit: number | null; // ADMIN-EDITABLE ONLY. null = unlimited. Enforced against active team-member count.
  // ADMIN-EDITABLE ONLY. Only meaningful/editable when parentOrgId is null — a
  // branch always inherits its parent org's ragThresholds instead (spec: "drill
  // down businesses will have the same what is set for the group").
  ragThresholds: IRagThresholds;
  // ADMIN-EDITABLE ONLY. Which advanced features (see features/flags.ts)
  // are turned on for this account — e.g. gating Reports/Playbooks by plan
  // tier, or holding a feature back from a pilot account. undefined/null
  // (any record saved before this field existed) means "all on" — see
  // hasFeature() — so this never silently locks an existing account out.
  enabledFeatures: string[] | null;
  // ADMIN-EDITABLE ONLY. Which product line(s) this business has bought —
  // Customer Experience, Colleague Experience, or both. null/empty means
  // Customer Experience only (see getEnabledProducts()) — every record
  // saved before Colleague Experience existed defaults there, never to
  // "all products". Gates both nav visibility and billing line items.
  enabledProducts: Product[] | null;
  // ADMIN-EDITABLE ONLY. Per-account override of PlatformSettings'
  // paymentGateEnabled kill switch: null = follow the platform default,
  // true/false = force the gate on/off for this account regardless of the
  // platform default. Lets Admin turn billing enforcement on for one
  // account being tested without affecting every other account.
  paymentGateEnabled: boolean | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DemographicConfigSchema = new Schema<IDemographicConfig>(
  {
    name: { type: String, enum: DEMOGRAPHIC_MODES, default: "off" },
    email: { type: String, enum: DEMOGRAPHIC_MODES, default: "off" },
    phone: { type: String, enum: DEMOGRAPHIC_MODES, default: "off" },
    ageGroup: { type: String, enum: DEMOGRAPHIC_MODES, default: "off" },
    gender: { type: String, enum: DEMOGRAPHIC_MODES, default: "off" },
  },
  { _id: false }
);

const BusinessSchema = new Schema<IBusiness>(
  {
    name: { type: String, required: true, trim: true },
    industry: { type: String, default: "" },
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", default: null },
    region: { type: String, default: "" },
    contactName: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    address: { type: AddressSchema, default: () => ({}) },
    billingAddressSameAsAddress: { type: Boolean, default: true },
    billingAssignment: { type: String, enum: BILLING_ASSIGNMENTS, default: "unassigned" },
    pricingTerms: { type: PricingTermsSchema, default: () => ({ ...DEFAULT_PRICING_TERMS }) },
    groupPaysStripeSubscriptionItemId: { type: String, default: "" },
    checkoutEnabled: { type: Boolean, default: false },
    escalationLevels: { type: [EscalationLevelSchema], default: () => DEFAULT_ESCALATION_LEVELS.map((l) => ({ ...l })) },
    escalationSlaHours: { type: Number, default: null },
    plan: { type: String, enum: BUSINESS_PLANS, default: "business_monthly" },
    maxFeedbackPoints: { type: Number, default: 1 },
    questionTemplateId: { type: Schema.Types.ObjectId, ref: "QuestionTemplate", default: null },
    demographicConfig: { type: DemographicConfigSchema, default: () => ({}) },
    accountManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    teamMemberSeatLimit: { type: Number, default: null },
    ragThresholds: { type: RagThresholdsSchema, default: () => ({ ...DEFAULT_RAG_THRESHOLDS }) },
    enabledFeatures: { type: [String], default: null },
    enabledProducts: { type: [String], enum: PRODUCTS, default: null },
    paymentGateEnabled: { type: Boolean, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// parentOrgId is the single hottest filter on this collection — nearly
// every Group-portal page (branches, compare, analytics, raw feedback,
// billing, ...) queries by it. accountManagerId backs the Admin scoped
// (account-manager-only) view of "my businesses".
BusinessSchema.index({ parentOrgId: 1 });
BusinessSchema.index({ accountManagerId: 1 });

export const Business: Model<IBusiness> = mongoose.models.Business ?? model<IBusiness>("Business", BusinessSchema);
