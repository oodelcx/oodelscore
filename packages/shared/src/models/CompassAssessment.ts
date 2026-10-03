import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";
import { ANCHOR_DIMENSIONS, type AnchorDimension } from "../compass/questionBank";
import { COMPASS_STAGES, type CompassStage, type LadderValue } from "../compass/scoring";

/**
 * One account's OodelCX Compass assessment — see PRODUCT-ROADMAP.md
 * Phase 7. `answers` is append-only per question (re-answering a question
 * overwrites its own entry, never appends a duplicate — enforced in the
 * API layer, not the schema). The `results` snapshot is recomputed and
 * overwritten every time the assessment is (re-)submitted via
 * computeCompassResult() — it is a cache of a pure function's output, not
 * a second source of truth, so it's always safe to recompute from
 * `answers` if the two ever look inconsistent.
 */
export interface ICompassAnswer {
  questionKey: string;
  dimension: AnchorDimension;
  value: LadderValue;
  // Snapshot of the question's wording at the moment it was answered — so
  // a later admin edit to the live question bank never silently rewrites
  // history. Optional/blank on an answer saved before this field existed.
  questionText: string;
}

export interface ICompassDimensionScore {
  dimension: AnchorDimension;
  score: LadderValue;
}

export interface ICompassAssessment {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  // Snapshot of the industry used to render this assessment's question
  // wording — captured at start so a later industry change on the
  // account doesn't retroactively reword an in-progress or completed
  // assessment.
  industry: string;
  status: "draft" | "completed";
  answers: ICompassAnswer[];
  // Null until at least one submission has been scored.
  dimensionScores: ICompassDimensionScore[] | null;
  overallScore: LadderValue | null;
  stage: CompassStage | null;
  gatingDimensions: AnchorDimension[];
  index: number | null;
  completedAt: Date | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CompassAnswerSchema = new Schema<ICompassAnswer>(
  {
    questionKey: { type: String, required: true },
    dimension: { type: String, enum: ANCHOR_DIMENSIONS, required: true },
    value: { type: Number, min: 0, max: 3, required: true },
    questionText: { type: String, default: "" },
  },
  { _id: false }
);

const CompassDimensionScoreSchema = new Schema<ICompassDimensionScore>(
  {
    dimension: { type: String, enum: ANCHOR_DIMENSIONS, required: true },
    score: { type: Number, min: 0, max: 3, required: true },
  },
  { _id: false }
);

const CompassAssessmentSchema = new Schema<ICompassAssessment>(
  {
    ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    industry: { type: String, default: "" },
    status: { type: String, enum: ["draft", "completed"], default: "draft" },
    answers: { type: [CompassAnswerSchema], default: [] },
    dimensionScores: { type: [CompassDimensionScoreSchema], default: null },
    overallScore: { type: Number, min: 0, max: 3, default: null },
    stage: { type: String, enum: COMPASS_STAGES, default: null },
    gatingDimensions: { type: [String], enum: ANCHOR_DIMENSIONS, default: [] },
    index: { type: Number, min: 0, max: 100, default: null },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// One assessment per owner at a time is the 7a/7b assumption — Phase 8's
// re-assessment tracking (PRODUCT-ROADMAP.md) will need to relax this to
// keep history, at which point this becomes a non-unique lookup index.
CompassAssessmentSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export const CompassAssessment: Model<ICompassAssessment> =
  mongoose.models.CompassAssessment ?? model<ICompassAssessment>("CompassAssessment", CompassAssessmentSchema);
