import mongoose, { Schema, model, type Model } from "mongoose";

export interface ITooltipEntry {
  key: string;
  label: string;
  text: string;
}

export interface ITooltipScreen {
  screenKey: string;
  screenLabel: string;
  tooltips: ITooltipEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const TooltipEntrySchema = new Schema<ITooltipEntry>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const TooltipScreenSchema = new Schema<ITooltipScreen>(
  {
    screenKey: { type: String, required: true, unique: true },
    screenLabel: { type: String, required: true },
    // Ordered array (not a Map) — order drives display order in the admin
    // editor, and Mongoose Maps don't preserve insertion order reliably.
    tooltips: { type: [TooltipEntrySchema], default: [] },
  },
  { timestamps: true }
);

export const TooltipScreen: Model<ITooltipScreen> =
  mongoose.models.TooltipScreen ?? model<ITooltipScreen>("TooltipScreen", TooltipScreenSchema);
