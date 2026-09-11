import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";

export const INVOICE_STATUSES = ["paid", "failed", "refunded"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface IInvoice {
  subscriptionId: Types.ObjectId;
  ownerType: BillingOwnerType; // denormalized for the platform-wide invoice ledger
  ownerId: Types.ObjectId;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  stripeInvoiceId: string;
  paymentMethodLast4: string;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: "BillingSubscription", required: true },
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    status: { type: String, enum: INVOICE_STATUSES, default: "paid" },
    stripeInvoiceId: { type: String, default: "" },
    paymentMethodLast4: { type: String, default: "" },
    issuedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

InvoiceSchema.index({ ownerType: 1, ownerId: 1, issuedAt: -1 });

export const Invoice: Model<IInvoice> = mongoose.models.Invoice ?? model<IInvoice>("Invoice", InvoiceSchema);
