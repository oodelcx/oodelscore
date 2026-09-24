import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";
import { PRODUCTS, type Product } from "./products";

export const CX_GOAL_METRICS = ["starAverage", "nps", "categoryAverage", "cxPulseLevel", "overdueActionsCount"] as const;
export type CxGoalMetric = (typeof CX_GOAL_METRICS)[number];

export const CX_GOAL_STATUSES = ["active", "achieved", "missed", "archived"] as const;
export type CxGoalStatus = (typeof CX_GOAL_STATUSES)[number];

/**
 * Gives management something to work toward, not just a dashboard to watch —
 * "Increase cleanliness from 3.8 to 4.3 by December" tracked against the
 * same computed metrics everything else on the platform already uses.
 * `startValue` is captured once at creation so progress reads consistently
 * even as the underlying period window moves.
 */
export interface ICxGoal {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  // Which product this goal tracks — defaults to customer_experience so
  // every goal that predates Colleague Experience is unaffected. A single
  // owner can have goals for both products at once; each goal only ever
  // tracks one.
  product: Product;
  label: string;
  metric: CxGoalMetric;
  categoryId: Types.ObjectId | null; // required when metric === "categoryAverage"
  startValue: number | null;
  targetValue: number;
  targetDate: Date;
  status: CxGoalStatus;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CxGoalSchema = new Schema<ICxGoal>(
  {
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
    label: { type: String, required: true },
    metric: { type: String, enum: CX_GOAL_METRICS, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    startValue: { type: Number, default: null },
    targetValue: { type: Number, required: true },
    targetDate: { type: Date, required: true },
    status: { type: String, enum: CX_GOAL_STATUSES, default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

CxGoalSchema.index({ ownerType: 1, ownerId: 1, status: 1 });

export const CxGoal: Model<ICxGoal> = mongoose.models.CxGoal ?? model<ICxGoal>("CxGoal", CxGoalSchema);
