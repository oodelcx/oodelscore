import mongoose, { Schema, model, type Model } from "mongoose";

export const SYSTEM_HEALTH_EVENT_TYPES = [
  "stripe_webhook_failure",
  "billing_sync_failure",
  "cron_failure",
  "api_route_error",
] as const;
export type SystemHealthEventType = (typeof SYSTEM_HEALTH_EVENT_TYPES)[number];

/**
 * Platform Health (Phase 5 item 20): before this, a failed Stripe webhook,
 * a failed billing sync, or a cron job that threw were only ever
 * console.error'd — visible in Render logs if someone happened to be
 * looking, never in the product. This is a lightweight, append-only record
 * of those failure classes plus unhandled errors on the most exposed API
 * routes (Phase 8 item P8.6 — "api_route_error"), shown on Admin -> Platform
 * Health. Never blocks the operation that failed to log it — see
 * observability/systemHealth.ts.
 */
export interface ISystemHealthEvent {
  type: SystemHealthEventType;
  message: string;
  context: Record<string, unknown>;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SystemHealthEventSchema = new Schema<ISystemHealthEvent>(
  {
    type: { type: String, enum: SYSTEM_HEALTH_EVENT_TYPES, required: true },
    message: { type: String, required: true },
    context: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

SystemHealthEventSchema.index({ occurredAt: -1 });
SystemHealthEventSchema.index({ type: 1, occurredAt: -1 });

export const SystemHealthEvent: Model<ISystemHealthEvent> =
  mongoose.models.SystemHealthEvent ?? model<ISystemHealthEvent>("SystemHealthEvent", SystemHealthEventSchema);
