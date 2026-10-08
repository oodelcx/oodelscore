import mongoose, { Schema, model, type Model } from "mongoose";

/**
 * One row per Stripe webhook event we have handled. Stripe retries events and
 * can deliver the same one twice; the unique _id (the Stripe event id) lets the
 * webhook route claim an event once and ignore repeats. Rows expire after 30 days.
 */
export interface IProcessedStripeEvent {
  _id: string;
  createdAt: Date;
}

const ProcessedStripeEventSchema = new Schema<IProcessedStripeEvent>(
  {
    _id: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
  },
  { versionKey: false }
);

export const ProcessedStripeEvent: Model<IProcessedStripeEvent> =
  (mongoose.models.ProcessedStripeEvent as Model<IProcessedStripeEvent>) ||
  model<IProcessedStripeEvent>("ProcessedStripeEvent", ProcessedStripeEventSchema);
