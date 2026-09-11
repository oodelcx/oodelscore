import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { AddressSchema, type IAddress } from "./common";

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
export const BUSINESS_ADMIN_ONLY_FIELDS = ["billingAssignment", "demographicConfig", "questionTemplateId"] as const;

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
  plan: BusinessPlan;
  maxFeedbackPoints: number;
  questionTemplateId: Types.ObjectId | null; // ADMIN-EDITABLE ONLY, ever
  demographicConfig: IDemographicConfig; // ADMIN-EDITABLE ONLY, ever
  accountManagerId: Types.ObjectId | null;
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
    plan: { type: String, enum: BUSINESS_PLANS, default: "business_monthly" },
    maxFeedbackPoints: { type: Number, default: 1 },
    questionTemplateId: { type: Schema.Types.ObjectId, ref: "QuestionTemplate", default: null },
    demographicConfig: { type: DemographicConfigSchema, default: () => ({}) },
    accountManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Business: Model<IBusiness> = mongoose.models.Business ?? model<IBusiness>("Business", BusinessSchema);
