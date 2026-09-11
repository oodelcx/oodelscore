import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";

export interface IPulseAnswer {
  question: string;
  answer: string;
}

export interface ICxPulsePulseResponse {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  quarter: string; // e.g. "2026-Q1"
  answers: IPulseAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

const PulseAnswerSchema = new Schema<IPulseAnswer>(
  {
    question: { type: String, required: true },
    answer: { type: String, default: "" },
  },
  { _id: false }
);

const CxPulsePulseResponseSchema = new Schema<ICxPulsePulseResponse>(
  {
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    quarter: { type: String, required: true },
    answers: { type: [PulseAnswerSchema], default: [] },
  },
  { timestamps: true }
);

CxPulsePulseResponseSchema.index({ ownerType: 1, ownerId: 1, quarter: 1 }, { unique: true });

export const CxPulsePulseResponse: Model<ICxPulsePulseResponse> =
  mongoose.models.CxPulsePulseResponse ?? model<ICxPulsePulseResponse>("CxPulsePulseResponse", CxPulsePulseResponseSchema);
