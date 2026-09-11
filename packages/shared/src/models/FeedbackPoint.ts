import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { DEMOGRAPHIC_MODES, type DemographicMode } from "./Business";

export const FORM_LAYOUTS = ["single_page", "one_per_screen"] as const;
export type FormLayout = (typeof FORM_LAYOUTS)[number];

export interface IDemographicOverride {
  name: DemographicMode;
  email: DemographicMode;
  phone: DemographicMode;
  ageGroup: DemographicMode;
  gender: DemographicMode;
}

export interface IFeedbackPoint {
  businessId: Types.ObjectId;
  name: string;
  description: string;
  qrToken: string; // random, unguessable — generated server-side on insert
  questionTemplateOverride: Types.ObjectId | null; // null = use business's default template
  formLayoutOverride: FormLayout | null; // null = use business default
  demographicOverride: IDemographicOverride | null; // null = use business default demographicConfig
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DemographicOverrideSchema = new Schema<IDemographicOverride>(
  {
    name: { type: String, enum: DEMOGRAPHIC_MODES },
    email: { type: String, enum: DEMOGRAPHIC_MODES },
    phone: { type: String, enum: DEMOGRAPHIC_MODES },
    ageGroup: { type: String, enum: DEMOGRAPHIC_MODES },
    gender: { type: String, enum: DEMOGRAPHIC_MODES },
  },
  { _id: false }
);

const FeedbackPointSchema = new Schema<IFeedbackPoint>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    qrToken: { type: String, required: true, unique: true },
    questionTemplateOverride: { type: Schema.Types.ObjectId, ref: "QuestionTemplate", default: null },
    formLayoutOverride: { type: String, enum: FORM_LAYOUTS, default: null },
    demographicOverride: { type: DemographicOverrideSchema, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const FeedbackPoint: Model<IFeedbackPoint> =
  mongoose.models.FeedbackPoint ?? model<IFeedbackPoint>("FeedbackPoint", FeedbackPointSchema);
