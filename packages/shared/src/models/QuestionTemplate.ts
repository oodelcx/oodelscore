import { Schema, model, models, type Model, type Types } from "mongoose";

export const QUESTION_TYPES = [
  "star_1_5",
  "nps_0_10",
  "open_text",
  "yes_no",
  "emoji_scale",
  "multiple_choice",
  "multi_select",
  "slider",
  "dropdown",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface IQuestion {
  text: string;
  type: QuestionType;
  categoryId: Types.ObjectId | null;
  required: boolean;
  isTracker: boolean;
  options: string[]; // for multiple_choice / multi_select / dropdown
}

export interface IQuestionTemplate {
  name: string;
  suggestedIndustries: string[]; // drives "suggested first" behavior in Business creation
  questions: IQuestion[];
  usedByCount: number; // denormalized, recompute on business save
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    text: { type: String, required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    required: { type: Boolean, default: false },
    isTracker: { type: Boolean, default: false },
    options: { type: [String], default: [] },
  },
  { _id: false }
);

const QuestionTemplateSchema = new Schema<IQuestionTemplate>(
  {
    name: { type: String, required: true, trim: true },
    suggestedIndustries: { type: [String], default: [] },
    questions: { type: [QuestionSchema], default: [] },
    usedByCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const QuestionTemplate: Model<IQuestionTemplate> =
  models.QuestionTemplate ?? model<IQuestionTemplate>("QuestionTemplate", QuestionTemplateSchema);
