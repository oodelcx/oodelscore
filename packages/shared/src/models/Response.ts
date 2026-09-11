import { Schema, model, models, type Model, type Types } from "mongoose";
import { QUESTION_TYPES, type QuestionType } from "./QuestionTemplate";

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
  answers: IAnswer[];
  respondentEmail: string | null; // null if not collected
  demographics: IDemographics;
  submittedAt: Date;
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
    answers: { type: [AnswerSchema], default: [] },
    respondentEmail: { type: String, default: null },
    demographics: { type: DemographicsSchema, default: () => ({}) },
    submittedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

ResponseSchema.index({ businessId: 1, submittedAt: -1 });

export const Response: Model<IResponse> = models.Response ?? model<IResponse>("Response", ResponseSchema);
