import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export const BILLING_OWNER_TYPES = ["business", "parentOrg"] as const;
export type BillingOwnerType = (typeof BILLING_OWNER_TYPES)[number];

export const SUBSCRIPTION_STATUSES = ["active", "overdue", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const COMP_PERIODS = ["15_days", "30_days", "60_days", "unlimited", "custom"] as const;
export type CompPeriod = (typeof COMP_PERIODS)[number];

/**
 * Rule (spec Section 2/5, bug #2): a `businesses` doc with
 * billingAssignment "group_pays" must NOT have its own row here — its cost
 * rolls into the parent org's subscription. `ownerId` must always resolve
 * to an existing business/parentOrg; enforce at write time to avoid the
 * "Account: Unknown" orphaned-row bug found live.
 */
export interface IBillingSubscription {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: string;
  isComp: boolean;
  compPeriod: CompPeriod | null; // null unless isComp
  compStartedAt: Date | null;
  compExpiresAt: Date | null; // null = unlimited (or not comp)
  mrrValue: number; // 0 for comp
  nextPaymentDate: Date | null;
  status: SubscriptionStatus;
  paymentMethodLast4: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillingSubscriptionSchema = new Schema<IBillingSubscription>(
  {
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    stripeCustomerId: { type: String, default: "" },
    stripeSubscriptionId: { type: String, default: "" },
    plan: { type: String, default: "" },
    isComp: { type: Boolean, default: false },
    compPeriod: { type: String, enum: COMP_PERIODS, default: null },
    compStartedAt: { type: Date, default: null },
    compExpiresAt: { type: Date, default: null },
    mrrValue: { type: Number, default: 0 },
    nextPaymentDate: { type: Date, default: null },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "active" },
    paymentMethodLast4: { type: String, default: "" },
  },
  { timestamps: true }
);

BillingSubscriptionSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export const BillingSubscription: Model<IBillingSubscription> =
  mongoose.models.BillingSubscription ?? model<IBillingSubscription>("BillingSubscription", BillingSubscriptionSchema);
