import mongoose, { Schema, model, type Model } from "mongoose";
import { ANCHOR_DIMENSIONS, COMPASS_QUESTION_VARIANTS, type AnchorDimension, type CompassQuestionVariant } from "../compass/constants";

/**
 * OodelCX Compass's ANCHOR assessment question bank — admin-editable (add/
 * edit/delete/reorder), replacing the old hardcoded array in
 * ../compass/questionBank.ts. Every account still answers the same six
 * ANCHOR dimensions on the same 0-3 gate-scored ladder — that's what keeps
 * Compass comparable across accounts — but the actual question wording now
 * lives here instead of in code, and is identical for every industry (the
 * old per-industry {{token}} interpolation via IndustryContentPack is
 * retired; an admin who wants industry-flavored wording just types it
 * directly into the question text).
 */
export interface ICompassQuestion {
  key: string;
  dimension: AnchorDimension;
  // "shared" = asked once regardless of product. "cx"/"ex" = only asked
  // when the account has that product enabled.
  variant: CompassQuestionVariant;
  text: string;
  // Display/answer order within this dimension+variant group — lower first.
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const CompassQuestionSchema = new Schema<ICompassQuestion>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    dimension: { type: String, enum: ANCHOR_DIMENSIONS, required: true },
    variant: { type: String, enum: COMPASS_QUESTION_VARIANTS, default: "shared" },
    text: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CompassQuestionSchema.index({ dimension: 1, variant: 1, order: 1 });

export const CompassQuestion: Model<ICompassQuestion> =
  mongoose.models.CompassQuestion ?? model<ICompassQuestion>("CompassQuestion", CompassQuestionSchema);
