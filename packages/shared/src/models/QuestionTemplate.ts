import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { PRODUCTS, type Product } from "./products";

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
  // Stable identity for this question, so a Response's answer can reference
  // exactly which question was asked (see Response.answers[].questionId) —
  // this is what makes a per-question trend chart possible. Optional on a
  // plain literal being constructed for the first time; Mongoose assigns it
  // once the question is actually persisted as a subdocument.
  _id?: Types.ObjectId;
  text: string;
  type: QuestionType;
  categoryId: Types.ObjectId | null;
  required: boolean;
  options: string[]; // for multiple_choice / multi_select / dropdown
}

export interface IQuestionTemplate {
  name: string;
  // Which product this template is for — defaults to customer_experience
  // so every template that predates Colleague Experience is unaffected.
  // A Colleague Experience template must never carry a question that asks
  // for name/email/phone; that's enforced at survey-serving time (see the
  // public feedback routes), not here, so it holds even if a template is
  // accidentally reused across products.
  product: Product;
  suggestedIndustries: string[]; // drives "suggested first" behavior in Business creation
  questions: IQuestion[];
  usedByCount: number; // denormalized, recompute on business save
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  text: { type: String, required: true },
  type: { type: String, enum: QUESTION_TYPES, required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  required: { type: Boolean, default: false },
  options: { type: [String], default: [] },
});

const QuestionTemplateSchema = new Schema<IQuestionTemplate>(
  {
    name: { type: String, required: true, trim: true },
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
    suggestedIndustries: { type: [String], default: [] },
    questions: { type: [QuestionSchema], default: [] },
    usedByCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const QuestionTemplate: Model<IQuestionTemplate> =
  mongoose.models.QuestionTemplate ?? model<IQuestionTemplate>("QuestionTemplate", QuestionTemplateSchema);
