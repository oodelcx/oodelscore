import mongoose, { Schema, model, type Model } from "mongoose";

export interface ITourStepText {
  // Matches a step's stable key in the code-side structural definition
  // (apps/web/src/components/tour/tour-definitions.ts) — that file owns
  // which DOM element a step points at and in what order; this document
  // only owns the words, same split as TooltipScreen/SiteContent.
  key: string;
  title: string;
  body: string;
}

export interface ITourScreen {
  tourId: string;
  tourLabel: string; // shown on the "Take a tour" trigger's title/tooltip
  steps: ITourStepText[];
  createdAt: Date;
  updatedAt: Date;
}

const TourStepTextSchema = new Schema<ITourStepText>(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
  },
  { _id: false }
);

const TourScreenSchema = new Schema<ITourScreen>(
  {
    tourId: { type: String, required: true, unique: true },
    tourLabel: { type: String, required: true },
    steps: { type: [TourStepTextSchema], default: [] },
  },
  { timestamps: true }
);

export const TourScreen: Model<ITourScreen> =
  mongoose.models.TourScreen ?? model<ITourScreen>("TourScreen", TourScreenSchema);
