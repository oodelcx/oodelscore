import { Schema, model, models, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";

export type CxPulseLevel = 1 | 2 | 3 | 4 | 5;

export interface ICxPulseDimensions {
  awareness: number;
  response: number;
  ownership: number;
  culture: number;
  outcome: number;
}

/**
 * Computed, not hand-entered — see spec Section 7. Recomputed on a
 * scheduled job; never compute live in a page request.
 */
export interface ICxPulseScore {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  period: Date; // month this score covers
  dimensions: ICxPulseDimensions;
  compositeScore: number;
  level: CxPulseLevel;
  createdAt: Date;
  updatedAt: Date;
}

const CxPulseDimensionsSchema = new Schema<ICxPulseDimensions>(
  {
    awareness: { type: Number, required: true },
    response: { type: Number, required: true },
    ownership: { type: Number, required: true },
    culture: { type: Number, required: true },
    outcome: { type: Number, required: true },
  },
  { _id: false }
);

const CxPulseScoreSchema = new Schema<ICxPulseScore>(
  {
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    period: { type: Date, required: true },
    dimensions: { type: CxPulseDimensionsSchema, required: true },
    compositeScore: { type: Number, required: true },
    level: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
  },
  { timestamps: true }
);

CxPulseScoreSchema.index({ ownerType: 1, ownerId: 1, period: 1 }, { unique: true });

export const CxPulseScore: Model<ICxPulseScore> =
  models.CxPulseScore ?? model<ICxPulseScore>("CxPulseScore", CxPulseScoreSchema);
