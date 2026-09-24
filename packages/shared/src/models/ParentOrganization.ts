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
  // ADMIN-EDITABLE ONLY. Same per-account override as Business.paymentGateEnabled
  // — null follows the platform default, true/false forces the gate for this org.
  paymentGateEnabled: boolean | null;
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
    paymentGateEnabled: { type: Boolean, default: null },
  },
  { timestamps: true }
);

// Backs the Admin scoped (account-manager-only) view of "my parent orgs".
ParentOrganizationSchema.index({ accountManagerId: 1 });

export const ParentOrganization: Model<IParentOrganization> =
  mongoose.models.ParentOrganization ?? model<IParentOrganization>("ParentOrganization", ParentOrganizationSchema);
