import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { QUESTION_TYPES, type QuestionType } from "./QuestionTemplate";
import { PRODUCTS, type Product } from "./products";

export interface IAnswer {
  questionId: Types.ObjectId;
  type: QuestionType;
  value: unknown;
  categoryId: Types.ObjectId | null;
}

export interface IDemographics {
  ageGroup: string;
  gender: string;
}

export const DEVICE_TYPES = ["mobile", "tablet", "desktop", "unknown"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

/**
 * Raw feedback submissions.
 *
 * Scoring rule (spec Section 2 / bug #1): when computing any average score
 * shown to a user, only aggregate `star_1_5` type answers. NPS (`nps_0_10`)
 * is always its own separate metric — never averaged into the star score.
 * This bug shipped live as scores like "5.6/5"; do not reintroduce it.
 */
export interface IResponse {
  feedbackPointId: Types.ObjectId;
  businessId: Types.ObjectId;
  // Denormalized from FeedbackPoint.product at submit time, same reason as
  // eventId below — lets every future Colleague Experience aggregation
  // filter by product with no join. Defaults to customer_experience so
  // every response recorded before Colleague Experience existed is
  // unaffected.
  product: Product;
  eventId: Types.ObjectId | null; // denormalized from FeedbackPoint.eventId at submit time, so Analytics can group by event with no join
  answers: IAnswer[];
  respondentName: string | null; // null if not collected
  respondentEmail: string | null; // null if not collected
  respondentPhone: string | null; // null if not collected
  demographics: IDemographics;
  submittedAt: Date;
  deviceType: DeviceType; // derived server-side from the submitting request's User-Agent
  flagged: boolean; // Business/Group "Flag" action on Raw Feedback
  // Theme & Sentiment Intelligence (CX roadmap Phase 2): set from the
  // open_text answer, if any, by analyzeThemeSentiment. Null/[] until
  // analyzed — a response with no open-text answer is never analyzed and
  // stays null forever, which is the correct state, not a pending one.
  sentiment: Sentiment | null;
  themes: string[];
  sentimentAnalyzedAt: Date | null;
  // Colleague Experience only. True once this response's open comment has
  // gone through the unconditional per-response sensitive-comment screen
  // (see ai/sensitiveScreen.ts) and, if flagged, already been routed to a
  // case via autoTriageAndCreateActionItem — regardless of whether an Alert
  // Rule also later fires on the same response. Prevents that same comment
  // from being triaged into a second, duplicate case through the ordinary
  // alert-fire path.
  sensitiveRouted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnswerSchema = new Schema<IAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    value: { type: Schema.Types.Mixed },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  },
  { _id: false }
);

const DemographicsSchema = new Schema<IDemographics>(
  {
    ageGroup: { type: String, default: "" },
    gender: { type: String, default: "" },
  },
  { _id: false }
);

const ResponseSchema = new Schema<IResponse>(
  {
    feedbackPointId: { type: Schema.Types.ObjectId, ref: "FeedbackPoint", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    answers: { type: [AnswerSchema], default: [] },
    respondentName: { type: String, default: null },
    respondentEmail: { type: String, default: null },
    respondentPhone: { type: String, default: null },
    demographics: { type: DemographicsSchema, default: () => ({}) },
    submittedAt: { type: Date, required: true, default: Date.now },
    deviceType: { type: String, enum: DEVICE_TYPES, default: "unknown" },
    flagged: { type: Boolean, default: false },
    sentiment: { type: String, enum: SENTIMENTS, default: null },
    themes: { type: [String], default: [] },
    sentimentAnalyzedAt: { type: Date, default: null },
    sensitiveRouted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ResponseSchema.index({ businessId: 1, submittedAt: -1 });
// The device-independent dedup recheck on every public submit that
// includes contact info filters by feedbackPointId + submittedAt, not
// businessId — not covered by the index above.
ResponseSchema.index({ feedbackPointId: 1, submittedAt: -1 });

export const Response: Model<IResponse> = mongoose.models.Response ?? model<IResponse>("Response", ResponseSchema);
