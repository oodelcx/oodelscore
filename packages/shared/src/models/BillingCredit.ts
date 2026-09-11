import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";

export const BILLING_CREDIT_TYPES = ["credit", "refund"] as const;
export type BillingCreditType = (typeof BILLING_CREDIT_TYPES)[number];

/**
 * Written whenever Finance/Admin issues a credit or refund from Billing
 * Oversight. Permanent audit trail — never edited or deleted after creation.
 */
export interface IBillingCredit {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  type: BillingCreditType;
  amount: number;
  reason: string;
  issuedBy: Types.ObjectId; // -> users._id
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BillingCreditSchema = new Schema<IBillingCredit>(
  {
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: BILLING_CREDIT_TYPES, required: true },
    amount: { type: Number, required: true },
    reason: { type: String, default: "" },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    issuedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

export const BillingCredit: Model<IBillingCredit> =
  mongoose.models.BillingCredit ?? model<IBillingCredit>("BillingCredit", BillingCreditSchema);
