import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";

export const BILLING_CREDIT_TYPES = ["credit", "refund"] as const;
export type BillingCreditType = (typeof BILLING_CREDIT_TYPES)[number];

/**
 * Written whenever Finance/Admin issues a credit or refund from Billing
 * Oversight. Permanent audit trail — never edited or deleted after creation.
 *
 * Finalized scope (Phase 4 item 18): this is a record-keeping ledger only.
 * It does not call Stripe to adjust a real charge, and it is not a coupon
 * applied automatically to a future invoice — Finance still handles the
 * actual money movement (a manual Stripe refund/adjustment, a check, etc.)
 * outside this app, per CLAUDE.md's rule against unconfirmed real-world
 * Stripe side effects. What this app guarantees is that the record isn't
 * silently invisible: it's shown on the owning business/org's own Billing
 * page (see business/group billing routes + billing-client.tsx), not just
 * in Admin's internal view.
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
