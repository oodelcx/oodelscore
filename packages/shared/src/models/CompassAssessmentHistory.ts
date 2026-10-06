import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { BILLING_OWNER_TYPES, type BillingOwnerType } from "./BillingSubscription";
import { ANCHOR_DIMENSIONS, type AnchorDimension } from "../compass/questionBank";
import { COMPASS_STAGES, type CompassStage, type LadderValue } from "../compass/scoring";
import { CompassEvidenceEntrySchema, type ICompassDimensionScore, type ICompassEvidenceEntry } from "./CompassAssessment";

/**
 * Append-only snapshot of a completed OodelCX Compass assessment cycle,
 * taken right before `restartCompassAssessment()` wipes the live
 * CompassAssessment document for a retake (OBS2). CompassAssessment itself
 * stays "one row per owner" (see its own comment on relaxing that later) —
 * this collection is the cheaper way to keep retake history without
 * touching that document's shape or its unique index.
 */
export interface ICompassAssessmentHistory {
  ownerType: BillingOwnerType;
  ownerId: Types.ObjectId;
  industry: string;
  dimensionScores: ICompassDimensionScore[];
  overallScore: LadderValue;
  stage: CompassStage;
  gatingDimensions: AnchorDimension[];
  index: number;
  // Claimed-vs-proven snapshot from when this cycle was completed (empty on records that predate it).
  evidence: ICompassEvidenceEntry[];
  completedAt: Date;
  archivedAt: Date;
}

const CompassDimensionScoreSchema = new Schema<ICompassDimensionScore>(
  {
    dimension: { type: String, enum: ANCHOR_DIMENSIONS, required: true },
    score: { type: Number, min: 0, max: 3, required: true },
  },
  { _id: false }
);

const CompassAssessmentHistorySchema = new Schema<ICompassAssessmentHistory>({
  ownerType: { type: String, enum: BILLING_OWNER_TYPES, required: true },
  ownerId: { type: Schema.Types.ObjectId, required: true },
  industry: { type: String, default: "" },
  dimensionScores: { type: [CompassDimensionScoreSchema], default: [] },
  overallScore: { type: Number, min: 0, max: 3, required: true },
  stage: { type: String, enum: COMPASS_STAGES, required: true },
  gatingDimensions: { type: [String], enum: ANCHOR_DIMENSIONS, default: [] },
  index: { type: Number, min: 0, max: 100, required: true },
  evidence: { type: [CompassEvidenceEntrySchema], default: [] },
  completedAt: { type: Date, required: true },
  archivedAt: { type: Date, required: true, default: () => new Date() },
});

CompassAssessmentHistorySchema.index({ ownerType: 1, ownerId: 1, completedAt: -1 });

export const CompassAssessmentHistory: Model<ICompassAssessmentHistory> =
  mongoose.models.CompassAssessmentHistory ?? model<ICompassAssessmentHistory>("CompassAssessmentHistory", CompassAssessmentHistorySchema);
