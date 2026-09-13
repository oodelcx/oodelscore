import mongoose, { Schema, model, type Model } from "mongoose";
import type { ICxPulseDimensions } from "./CxPulseScore";

/** Singleton, admin-editable. Only one document should ever exist. */
export const CX_PULSE_FRAMEWORK_SINGLETON_KEY = "default";

export interface ICxPulseFramework {
  singletonKey: string;
  weights: ICxPulseDimensions; // sum to 100
  pulseQuestions: string[]; // quarterly self-assessment questions
  // One line per maturity level (index 0 = Level 1 Collecting ... index 4 =
  // Level 5 Embedded), shown under each rung of the ladder on the real CX
  // Pulse page. Admin-editable so the copy isn't hardcoded in the frontend.
  levelDescriptions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CxPulseWeightsSchema = new Schema<ICxPulseDimensions>(
  {
    awareness: { type: Number, required: true },
    response: { type: Number, required: true },
    ownership: { type: Number, required: true },
    culture: { type: Number, required: true },
    outcome: { type: Number, required: true },
  },
  { _id: false }
);

const CxPulseFrameworkSchema = new Schema<ICxPulseFramework>(
  {
    singletonKey: { type: String, required: true, unique: true, default: CX_PULSE_FRAMEWORK_SINGLETON_KEY },
    weights: { type: CxPulseWeightsSchema, required: true },
    pulseQuestions: { type: [String], default: [] },
    levelDescriptions: {
      type: [String],
      default: [
        "Feedback is collected but rarely reviewed.",
        "Managers see scores, but there's no routine action on them.",
        "Negative feedback gets actioned reliably.",
        "Named owners, playbooks, and closed loops on issues.",
        "Feedback drives measurable strategy shifts.",
      ],
    },
  },
  { timestamps: true }
);

export const CxPulseFramework: Model<ICxPulseFramework> =
  mongoose.models.CxPulseFramework ?? model<ICxPulseFramework>("CxPulseFramework", CxPulseFrameworkSchema);
