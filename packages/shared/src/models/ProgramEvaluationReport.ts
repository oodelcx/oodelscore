import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * One evaluation of a single training Event against the business's own
 * stated objectives — see ../scoring/programEvaluation.ts for how this is
 * built. Exactly one report per Event (re-running overwrites it; the
 * previous AI narrative isn't kept as history, same as CompassAssessment's
 * single-current-assessment convention — only the ANCHOR retake system
 * bothered with a separate History model, because it's the thing meant to
 * be tracked over time, unlike a one-off training evaluation).
 */
export const PROGRAM_EVALUATION_STATUSES = ["insufficient_data", "completed"] as const;
export type ProgramEvaluationStatus = (typeof PROGRAM_EVALUATION_STATUSES)[number];

export interface IProgramEvaluationDemographicCut {
  label: string; // e.g. "25-34", "Female", a branch/location name
  responseCount: number;
  starAverage: number | null;
}

export interface IProgramEvaluationObjectiveMatch {
  objective: string;
  verdict: "met" | "partially_met" | "not_supported";
  evidence: string; // must cite a specific number/quote from the evidence bundle, never free-associated
}

export interface IProgramEvaluationReport {
  businessId: Types.ObjectId;
  eventId: Types.ObjectId;
  status: ProgramEvaluationStatus;
  // Snapshot of the business's program details at the moment this report
  // ran — so a later edit to the Event's objectives doesn't retroactively
  // reword what this specific report actually evaluated.
  synopsis: string;
  objectives: string[];
  expectedOutcomes: string[];
  responseCount: number;
  starAverage: number | null;
  npsScore: number | null;
  ageGroupCuts: IProgramEvaluationDemographicCut[];
  genderCuts: IProgramEvaluationDemographicCut[];
  topThemes: string[];
  summary: string;
  objectiveMatches: IProgramEvaluationObjectiveMatch[];
  suggestions: string[];
  newAreasToExplore: string[];
  generatedByAi: boolean;
  fallbackReason: "no_api_key" | "api_error" | "parse_error" | null;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DemographicCutSchema = new Schema<IProgramEvaluationDemographicCut>(
  { label: { type: String, required: true }, responseCount: { type: Number, required: true }, starAverage: { type: Number, default: null } },
  { _id: false }
);

const ObjectiveMatchSchema = new Schema<IProgramEvaluationObjectiveMatch>(
  {
    objective: { type: String, required: true },
    verdict: { type: String, enum: ["met", "partially_met", "not_supported"], required: true },
    evidence: { type: String, required: true },
  },
  { _id: false }
);

const ProgramEvaluationReportSchema = new Schema<IProgramEvaluationReport>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    status: { type: String, enum: PROGRAM_EVALUATION_STATUSES, required: true },
    synopsis: { type: String, default: "" },
    objectives: { type: [String], default: [] },
    expectedOutcomes: { type: [String], default: [] },
    responseCount: { type: Number, default: 0 },
    starAverage: { type: Number, default: null },
    npsScore: { type: Number, default: null },
    ageGroupCuts: { type: [DemographicCutSchema], default: [] },
    genderCuts: { type: [DemographicCutSchema], default: [] },
    topThemes: { type: [String], default: [] },
    summary: { type: String, default: "" },
    objectiveMatches: { type: [ObjectiveMatchSchema], default: [] },
    suggestions: { type: [String], default: [] },
    newAreasToExplore: { type: [String], default: [] },
    generatedByAi: { type: Boolean, default: false },
    fallbackReason: { type: String, enum: ["no_api_key", "api_error", "parse_error", null], default: null },
    generatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

ProgramEvaluationReportSchema.index({ eventId: 1 }, { unique: true });
ProgramEvaluationReportSchema.index({ businessId: 1 });

export const ProgramEvaluationReport: Model<IProgramEvaluationReport> =
  mongoose.models.ProgramEvaluationReport ?? model<IProgramEvaluationReport>("ProgramEvaluationReport", ProgramEvaluationReportSchema);
