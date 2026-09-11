import { Schema, model, models, type Model } from "mongoose";
import type { ICxPulseDimensions } from "./CxPulseScore";

/** Singleton, admin-editable. Only one document should ever exist. */
export const CX_PULSE_FRAMEWORK_SINGLETON_KEY = "default";

export interface ICxPulseFramework {
  singletonKey: string;
  weights: ICxPulseDimensions; // sum to 100
  pulseQuestions: string[]; // quarterly self-assessment questions
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
  },
  { timestamps: true }
);

export const CxPulseFramework: Model<ICxPulseFramework> =
  models.CxPulseFramework ?? model<ICxPulseFramework>("CxPulseFramework", CxPulseFrameworkSchema);
