import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { DEMOGRAPHIC_MODES, type DemographicMode, type IDemographicConfig, type IBusiness } from "./Business";
import { PRODUCTS, type Product } from "./products";
import { LIFECYCLE_STAGES, type LifecycleStage } from "./RosterEntry";
import { QUESTION_TYPES, type IQuestion } from "./QuestionTemplate";

export const FORM_LAYOUTS = ["single_page", "one_per_screen"] as const;
export type FormLayout = (typeof FORM_LAYOUTS)[number];

// Colleague Experience's three distribution modes (see the CE roadmap).
// "qr_open" is the default/CX-equivalent behavior: one shared QR/link, no
// per-person tracking. "roster_personalized" ties this feedback point to
// the business's roster — mintRosterSurveyTokens()/sendRosterSurveyLinks()
// issue one token per active roster entry so participation can be counted.
// Meaningless for customer_experience points, which always behave as
// qr_open regardless of this field.
export const DISTRIBUTION_MODES = ["qr_open", "roster_personalized"] as const;
export type DistributionMode = (typeof DISTRIBUTION_MODES)[number];

// Automatic send cadence for a roster_personalized recurring pulse survey
// (lifecycleTrigger: null). null = manual only — the business sends/resends
// itself from the Colleague Roster page. Meaningless for a lifecycle-
// triggered survey (that fires per-person off RosterEntry dates, not on a
// clock) or a qr_open point.
export const PULSE_CADENCES = ["weekly", "monthly"] as const;
export type PulseCadence = (typeof PULSE_CADENCES)[number];

// How this point is meant to be distributed — purely a UI hint, never
// enforced at the submit route (the same token always works as both a
// scanned QR and a shared URL). "qr" hides link-sharing copy and shows the
// poster/QR tools; "link" hides the poster/QR tools and the scan-pattern
// heatmap (which would otherwise read as all-zero for a point nobody ever
// scans); "both" (the default, and the only behavior that existed before
// this field) shows everything.
export const DELIVERY_MODES = ["qr", "link", "both"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

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
  // Colleague Experience only. null = this is the recurring pulse survey (or
  // a plain one-off campaign); set = this specific feedback point is the
  // designated survey for that lifecycle stage (onboarding day-30/90, or
  // exit) for its business. The lifecycle-trigger cron looks up a business's
  // feedback point by (product: "colleague_experience", lifecycleTrigger:
  // <stage>) to know which survey to send someone — a business that hasn't
  // set one up for a given stage is simply skipped, not an error.
  lifecycleTrigger: LifecycleStage | null;
  // When this lifecycle survey went live. Only people whose milestone (day 30, day 90, or
  // their exit date) falls on or after this moment are ever emailed, so switching a survey on
  // never sends a surprise email to someone whose milestone was already in the past. Set when
  // lifecycleTrigger is first assigned; the daily job sets it on first sight if it is missing.
  lifecycleGoLiveAt: Date | null;
  // Colleague Experience only (see DISTRIBUTION_MODES above). null behaves
  // as "qr_open" — kept nullable rather than defaulted in the schema so a
  // pre-existing point (all customer_experience) is unambiguously "never
  // set", not "explicitly qr_open".
  distributionMode: DistributionMode | null;
  // Recurring pulse only (see PULSE_CADENCES above). null = send manually.
  pulseCadence: PulseCadence | null;
  // Last time the cadence cron (or a manual "send now") went out for this
  // point — null means never sent. Drives "is this due yet" for the cron
  // and "last sent" for the Business portal's participation view.
  lastSentAt: Date | null;
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
  // Business-side survey builder (PRODUCT-ROADMAP.md Phase 6), legacy path:
  // a business composes a point's survey from an Admin-authored
  // QuestionTemplate's already-existing questions — which ones, and in what
  // order — without ever touching the template itself. null = use the full
  // template as-is, in its own order (every point created before this
  // field existed, and any Admin-created point that doesn't set it).
  // Superseded by `customQuestions` below for anything built through the
  // real question-authoring builder; kept only so pre-existing points built
  // this way keep working unchanged.
  selectedQuestionIds: Types.ObjectId[] | null;
  // Business-side survey builder, real path: the point's own fully-authored
  // question set — freely typed text, any of the QUESTION_TYPES, its own
  // options/required/category per question — independent of any
  // QuestionTemplate from the moment it's built (a template, when the
  // builder starts from one, is only a starting copy; editing here never
  // writes back to the template). null or empty = not built this way, fall
  // back to questionTemplateOverride/selectedQuestionIds. Takes priority
  // over both when set — see effectiveQuestions() below.
  customQuestions: IQuestion[] | null;
  // Business-side survey builder: auto-closes this point once it has
  // received this many responses, same "don't have to remember to turn
  // it off" reasoning as startsAt/endsAt above. null = unlimited.
  responseQuota: number | null;
  // See DELIVERY_MODES above. Defaults to "both" so every point created
  // before this field existed keeps behaving exactly as it always has.
  deliveryMode: DeliveryMode;
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

// Mirrors QuestionTemplate's own QuestionSchema exactly (kept as a separate
// definition rather than imported, since Mongoose subdocument schemas are
// tied to the field they're embedded in) — same shape, so a question
// copied in from a template on build, or authored from scratch, behaves
// identically either way once it's part of a FeedbackPoint's own set.
const CustomQuestionSchema = new Schema<IQuestion>({
  text: { type: String, required: true },
  type: { type: String, enum: QUESTION_TYPES, required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  required: { type: Boolean, default: false },
  options: { type: [String], default: [] },
  isCsatQuestion: { type: Boolean, default: false },
});

const FeedbackPointSchema = new Schema<IFeedbackPoint>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    lifecycleTrigger: { type: String, enum: LIFECYCLE_STAGES, default: null },
    lifecycleGoLiveAt: { type: Date, default: null },
    distributionMode: { type: String, enum: DISTRIBUTION_MODES, default: null },
    pulseCadence: { type: String, enum: PULSE_CADENCES, default: null },
    lastSentAt: { type: Date, default: null },
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
    selectedQuestionIds: { type: [Schema.Types.ObjectId], default: null },
    customQuestions: { type: [CustomQuestionSchema], default: null },
    responseQuota: { type: Number, default: null },
    deliveryMode: { type: String, enum: DELIVERY_MODES, default: "both" },
  },
  { timestamps: true }
);

// qrToken already gets a unique index from `unique: true` above (the
// hot path on every public QR scan/submit) — businessId is the other
// heavily-filtered field, queried on nearly every Feedback Points listing.
FeedbackPointSchema.index({ businessId: 1 });
FeedbackPointSchema.index({ eventId: 1 });
// The daily lifecycle-trigger cron's lookup: "does this business have a
// designated survey for this stage?"
FeedbackPointSchema.index({ businessId: 1, product: 1, lifecycleTrigger: 1 });
// The daily pulse-cadence cron's scan for due recurring surveys.
FeedbackPointSchema.index({ product: 1, distributionMode: 1, pulseCadence: 1 });

/** True once `active` is on AND, if a date window is set, `now` falls inside it. */
export function isFeedbackPointOpen(point: Pick<IFeedbackPoint, "active" | "startsAt" | "endsAt">, now: Date = new Date()): boolean {
  if (!point.active) return false;
  if (point.startsAt && now < point.startsAt) return false;
  if (point.endsAt && now > point.endsAt) return false;
  return true;
}

/**
 * The survey a feedback point actually renders/validates. Three cases, in
 * priority order: (1) the point built its own question set through the
 * real survey builder (`customQuestions` set) — used exactly as authored,
 * no template involved at all; (2) the legacy builder narrowed/reordered a
 * subset of the parent template's questions (`selectedQuestionIds` set);
 * (3) neither is set — the full template as-is, in its own order (every
 * point created before either builder existed, and any Admin-created point
 * that doesn't override). Both the public GET (render) and submit
 * (validate + persist) routes must derive their question list from this
 * one function, the same discipline effectiveDemographicConfig below
 * already establishes, so the two routes can never disagree about which
 * question a given index refers to.
 */
export function effectiveQuestions<Q extends { _id?: Types.ObjectId }>(
  point: Pick<IFeedbackPoint, "selectedQuestionIds"> & { customQuestions?: Q[] | null },
  template: { questions: Q[] }
): Q[] {
  if (point.customQuestions && point.customQuestions.length > 0) return point.customQuestions;
  if (!point.selectedQuestionIds || point.selectedQuestionIds.length === 0) return template.questions;
  const byId = new Map(template.questions.map((q) => [q._id?.toString(), q]));
  return point.selectedQuestionIds.map((id) => byId.get(id.toString())).filter((q): q is Q => !!q);
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
  // Never spread `config` here: business.demographicConfig is a live
  // Mongoose subdocument, and spreading one pulls in its internal
  // properties — including $__parent, a full backreference to the parent
  // Business document (billing IDs, RAG thresholds, plan, everything). That
  // leaked the entire Business record through this public, no-login
  // endpoint's response. Build a plain object from named fields only, for
  // both branches — this function's contract is a plain IDemographicConfig,
  // never a live Mongoose (sub)document.
  if (point.product === "colleague_experience") {
    return { name: "off", email: "off", phone: "off", ageGroup: config.ageGroup, gender: config.gender };
  }
  return { name: config.name, email: config.email, phone: config.phone, ageGroup: config.ageGroup, gender: config.gender };
}

export const FeedbackPoint: Model<IFeedbackPoint> =
  mongoose.models.FeedbackPoint ?? model<IFeedbackPoint>("FeedbackPoint", FeedbackPointSchema);
