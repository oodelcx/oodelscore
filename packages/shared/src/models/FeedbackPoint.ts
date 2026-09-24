import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { DEMOGRAPHIC_MODES, type DemographicMode, type IDemographicConfig, type IBusiness } from "./Business";
import { PRODUCTS, type Product } from "./products";

export const FORM_LAYOUTS = ["single_page", "one_per_screen"] as const;
export type FormLayout = (typeof FORM_LAYOUTS)[number];

export interface IDemographicOverride {
  name: DemographicMode;
  email: DemographicMode;
  phone: DemographicMode;
  ageGroup: DemographicMode;
  gender: DemographicMode;
}

export interface IFeedbackPoint {
  businessId: Types.ObjectId;
  // Which product this collection point belongs to — a Customer Experience
  // QR/link (a till, a branch) or a Colleague Experience one (a staff
  // pulse survey entry point). Defaults to customer_experience so every
  // feedback point that predates Colleague Experience is unaffected.
  product: Product;
  eventId: Types.ObjectId | null; // null = place-based (a fixed branch/till); set = one instance of an Event (a session/flight/class)
  name: string;
  description: string;
  qrToken: string; // random, unguessable — generated server-side on insert
  questionTemplateOverride: Types.ObjectId | null; // null = use business's default template
  formLayoutOverride: FormLayout | null; // null = use business default
  demographicOverride: IDemographicOverride | null; // null = use business default demographicConfig
  scans: number; // incremented each time the public feedback page loads — powers conversion rate (responses / scans)
  active: boolean;
  // Optional date-bound auto-close (e.g. "this survey runs Nov 1-30"):
  // once endsAt has passed the link is treated as closed even if `active`
  // is still true, so a business doesn't have to remember to toggle it off.
  // Independent of eventId — a plain year-round QR code just leaves both null.
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DemographicOverrideSchema = new Schema<IDemographicOverride>(
  {
    name: { type: String, enum: DEMOGRAPHIC_MODES },
    email: { type: String, enum: DEMOGRAPHIC_MODES },
    phone: { type: String, enum: DEMOGRAPHIC_MODES },
    ageGroup: { type: String, enum: DEMOGRAPHIC_MODES },
    gender: { type: String, enum: DEMOGRAPHIC_MODES },
  },
  { _id: false }
);

const FeedbackPointSchema = new Schema<IFeedbackPoint>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    qrToken: { type: String, required: true, unique: true },
    questionTemplateOverride: { type: Schema.Types.ObjectId, ref: "QuestionTemplate", default: null },
    formLayoutOverride: { type: String, enum: FORM_LAYOUTS, default: null },
    demographicOverride: { type: DemographicOverrideSchema, default: null },
    scans: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// qrToken already gets a unique index from `unique: true` above (the
// hot path on every public QR scan/submit) — businessId is the other
// heavily-filtered field, queried on nearly every Feedback Points listing.
FeedbackPointSchema.index({ businessId: 1 });
FeedbackPointSchema.index({ eventId: 1 });

/** True once `active` is on AND, if a date window is set, `now` falls inside it. */
export function isFeedbackPointOpen(point: Pick<IFeedbackPoint, "active" | "startsAt" | "endsAt">, now: Date = new Date()): boolean {
  if (!point.active) return false;
  if (point.startsAt && now < point.startsAt) return false;
  if (point.endsAt && now > point.endsAt) return false;
  return true;
}

/**
 * The demographic config a survey actually renders/enforces for one
 * feedback point — normally just the business default or the point's own
 * override, EXCEPT for Colleague Experience, where name/email/phone are
 * forced to "off" here regardless of what either config says. This is the
 * one place both the public GET (render) and submit (validate + persist)
 * routes must call, so there is no path — misconfiguration included —
 * that collects an employee's identity on a Colleague Experience response.
 */
export function effectiveDemographicConfig(
  point: Pick<IFeedbackPoint, "product" | "demographicOverride">,
  business: Pick<IBusiness, "demographicConfig">
): IDemographicConfig {
  const config = point.demographicOverride ?? business.demographicConfig;
  if (point.product !== "colleague_experience") return config;
  return { ...config, name: "off", email: "off", phone: "off" };
}

export const FeedbackPoint: Model<IFeedbackPoint> =
  mongoose.models.FeedbackPoint ?? model<IFeedbackPoint>("FeedbackPoint", FeedbackPointSchema);
