import mongoose, { Schema, model, type Model } from "mongoose";

export interface IRateLimitHit {
  key: string; // e.g. "feedback-scan:<ip>:<feedbackPointId>"
  windowStart: Date;
  count: number;
  createdAt: Date;
}

// Fixed-window counter for lightweight abuse protection on public routes
// (no Redis/queue infra in this stack, so Mongo does the counting — see
// packages/shared/src/security/rateLimit.ts). TTL cleans up old windows
// automatically; the (key, windowStart) unique index is what makes the
// increment-or-create in checkRateLimit atomic under concurrent requests.
const RateLimitHitSchema = new Schema<IRateLimitHit>({
  key: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
});
RateLimitHitSchema.index({ key: 1, windowStart: 1 }, { unique: true });

export const RateLimitHit: Model<IRateLimitHit> =
  mongoose.models.RateLimitHit ?? model<IRateLimitHit>("RateLimitHit", RateLimitHitSchema);
