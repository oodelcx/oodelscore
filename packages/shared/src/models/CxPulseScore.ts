import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";
import { PRODUCTS, type Product } from "./products";

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
  // Which product this score covers — defaults to customer_experience so
  // every score computed before Colleague Experience existed is unaffected.
  // Kept as a discriminator on this same collection/model for now rather
  // than a full CxPulseScore -> PulseScore rename; that generalization is
  // deferred to the phase that actually builds Colleague Experience's own
  // pulse-score computation, which is when a second real dimension set
  // exists to justify it.
  product: Product;
  period: Date; // month this score covers
  dimensions: ICxPulseDimensions;
  compositeScore: number;
  level: CxPulseLevel;
  // Colleague Experience only — eNPS ((%promoters - %detractors) from
  // nps_0_10 answers) is CE's standing headline metric, reported alongside
  // the same awareness/response/ownership/culture/outcome maturity ladder
  // used for CX. Always null for a customer_experience row.
  enps: number | null;
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
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
    period: { type: Date, required: true },
    dimensions: { type: CxPulseDimensionsSchema, required: true },
    compositeScore: { type: Number, required: true },
    level: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
    enps: { type: Number, default: null },
  },
  { timestamps: true }
);

CxPulseScoreSchema.index({ ownerType: 1, ownerId: 1, period: 1, product: 1 }, { unique: true });
// The collection's old 3-field unique index (no `product`) predates
// Colleague Experience and rejects the second product's row for the same
// owner/period outright — not just redundant, an active write-time crash
// on any dual-product account until dropped. connectToDatabase() now runs
// CxPulseScore.syncIndexes() once per process on connect, so this
// self-heals in every environment rather than needing a manual drop.

export const CxPulseScore: Model<ICxPulseScore> =
  mongoose.models.CxPulseScore ?? model<ICxPulseScore>("CxPulseScore", CxPulseScoreSchema);
