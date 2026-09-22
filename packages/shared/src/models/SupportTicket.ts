import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";

export const SUPPORT_TICKET_CATEGORIES = ["billing", "bug", "access", "other"] as const;
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];

export const SUPPORT_TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

/**
 * Admin Support Queue (Phase 5 item 21): a channel for a business/group
 * owner to report a problem with OodelCX itself — a billing question, a
 * bug, an access issue — deliberately separate from Messages (a static
 * "here's who to contact" card) and from a business's own customer
 * feedback, which this has nothing to do with.
 */
export interface ISupportTicket {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  ownerName: string; // denormalized so Admin's queue needs no join
  submittedByUserId: Types.ObjectId;
  submittedByEmail: string;
  category: SupportTicketCategory;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  adminNote: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    ownerName: { type: String, required: true },
    submittedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedByEmail: { type: String, required: true },
    category: { type: String, enum: SUPPORT_TICKET_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    status: { type: String, enum: SUPPORT_TICKET_STATUSES, default: "open" },
    adminNote: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });

export const SupportTicket: Model<ISupportTicket> =
  mongoose.models.SupportTicket ?? model<ISupportTicket>("SupportTicket", SupportTicketSchema);
