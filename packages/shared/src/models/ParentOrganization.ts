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

export const BILLING_MODES = ["group_pays", "branch_pays"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

// Things a branch can either be trusted to run itself, or the org can keep
// centralized at group level. Every flag defaults true so an existing org's
// branches keep behaving exactly as they did before this existed — the org
// owner opts INTO locking something down, nothing opts them in automatically.
export const BRANCH_DELEGATABLE_PERMISSIONS = ["feedbackPoints", "categoryOwners", "cxGoals", "alertRules"] as const;
export type BranchDelegatablePermission = (typeof BRANCH_DELEGATABLE_PERMISSIONS)[number];

export interface IBranchPermissions {
  feedbackPoints: boolean; // true: branch can view its own points + request new ones from Admin (never create them directly, that's always Admin-only). false: nav item hidden, branch sees nothing under Setup for this.
  categoryOwners: boolean; // true: branch can set its own category->owner overrides for local staff. false: branch always uses the group's default mapping, no override UI.
  cxGoals: boolean; // true: branch can set its own CX goals independent of the group's. false: branch has no goals of its own, only sees the group's (read-only) if the group has any that apply to it.
  alertRules: boolean; // true: branch can set its own scope:"business" alert rules, in addition to inheriting the group's cascaded rules (read-only) as always. false: branch only sees the inherited group rules, cannot add its own.
}

const BranchPermissionsSchema = new Schema<IBranchPermissions>(
  {
    feedbackPoints: { type: Boolean, default: true },
    categoryOwners: { type: Boolean, default: true },
    cxGoals: { type: Boolean, default: true },
    alertRules: { type: Boolean, default: true },
  },
  { _id: false }
);

export interface IParentOrganization {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: IAddress;
  billingAddressSameAsAddress: boolean;
  defaultBillingMode: BillingMode; // default only for newly created businesses under this org
  // ADMIN-EDITABLE ONLY (no Group-level route can ever write to this field).
  // What the org itself is charged for every branch it covers under
  // "group_pays" — the org's Stripe subscription carries one line item per
  // such branch, all priced from this same rate.
  pricingTerms: IPricingTerms;
  // ADMIN-EDITABLE ONLY. Same meaning as pricingTerms, for the Colleague
  // Experience line — see Business.cePricingTerms for the full explanation.
  cePricingTerms: IPricingTerms;
  // ADMIN-EDITABLE ONLY. When true, the org's own billing page shows a
  // self-service "Continue to payment" link straight to Stripe Checkout —
  // covers the org paying for itself and/or its group_pays branches.
  checkoutEnabled: boolean;
  // ADMIN-EDITABLE ONLY. The org's own escalation chain, inherited by every
  // branch under it (same inheritance rule as ragThresholds) — level 1 is
  // always a branch's own owner regardless of this config; this defines
  // level 2 and above, labeled however the organisation calls them
  // ("Cluster Manager", "Regional Head", "President" — never hardcoded).
  escalationLevels: IEscalationLevel[];
  // ADMIN-EDITABLE ONLY. Hours an unresolved case may sit at its current
  // level before the cron auto-escalates it one level. null = manual only.
  escalationSlaHours: number | null;
  accountManagerId: Types.ObjectId | null; // -> users._id (staff)
  branchSeatLimit: number | null; // ADMIN-EDITABLE ONLY. null = unlimited. Enforced against active business count.
  teamMemberSeatLimit: number | null; // ADMIN-EDITABLE ONLY. The Group's own staff pool, independent of any branch's.
  ragThresholds: IRagThresholds; // ADMIN-EDITABLE ONLY. Inherited by every branch under this org.
  commandCenterEnabled: boolean; // ADMIN-EDITABLE ONLY. Whether the Group Command Center page is shown to this org's users.
  // ADMIN-EDITABLE ONLY. Which advanced features (see features/flags.ts) are
  // turned on for this org (and its branches — see hasFeature() call sites).
  // undefined/null means "all on" so existing orgs are unaffected until
  // Admin explicitly edits one.
  enabledFeatures: string[] | null;
  // ADMIN-EDITABLE ONLY. Which product line(s) this org has bought —
  // see Business.enabledProducts for the full explanation; same meaning
  // and same null-means-Customer-Experience-only default here.
  enabledProducts: Product[] | null;
  // Colleague Experience only, org-owner-editable — see
  // Business.sensitiveRoutingContactId for the full explanation. A branch
  // with no contact of its own falls back to its parent org's.
  sensitiveRoutingContactId: Types.ObjectId | null;
  // ADMIN-EDITABLE ONLY. Same per-account override as Business.paymentGateEnabled
  // — null follows the platform default, true/false forces the gate for this org.
  paymentGateEnabled: boolean | null;
  // GROUP-OWNER-EDITABLE. Whether each of these is delegated down to
  // branches or kept centralized at this org. See IBranchPermissions above.
  branchPermissions: IBranchPermissions;
  createdAt: Date;
  updatedAt: Date;
}

const ParentOrganizationSchema = new Schema<IParentOrganization>(
  {
    name: { type: String, required: true, trim: true },
    contactName: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    address: { type: AddressSchema, default: () => ({}) },
    billingAddressSameAsAddress: { type: Boolean, default: true },
    defaultBillingMode: { type: String, enum: BILLING_MODES, default: "branch_pays" },
    pricingTerms: { type: PricingTermsSchema, default: () => ({ ...DEFAULT_PRICING_TERMS }) },
    cePricingTerms: { type: PricingTermsSchema, default: () => ({ ...DEFAULT_PRICING_TERMS }) },
    checkoutEnabled: { type: Boolean, default: false },
    escalationLevels: { type: [EscalationLevelSchema], default: () => DEFAULT_ESCALATION_LEVELS.map((l) => ({ ...l })) },
    escalationSlaHours: { type: Number, default: null },
    accountManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    branchSeatLimit: { type: Number, default: null },
    teamMemberSeatLimit: { type: Number, default: null },
    ragThresholds: { type: RagThresholdsSchema, default: () => ({ ...DEFAULT_RAG_THRESHOLDS }) },
    commandCenterEnabled: { type: Boolean, default: true },
    enabledFeatures: { type: [String], default: null },
    enabledProducts: { type: [String], enum: PRODUCTS, default: null },
    sensitiveRoutingContactId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    paymentGateEnabled: { type: Boolean, default: null },
    branchPermissions: {
      type: BranchPermissionsSchema,
      default: () => ({ feedbackPoints: true, categoryOwners: true, cxGoals: true, alertRules: true }),
    },
  },
  { timestamps: true }
);

// Backs the Admin scoped (account-manager-only) view of "my parent orgs".
ParentOrganizationSchema.index({ accountManagerId: 1 });

export const ParentOrganization: Model<IParentOrganization> =
  mongoose.models.ParentOrganization ?? model<IParentOrganization>("ParentOrganization", ParentOrganizationSchema);
