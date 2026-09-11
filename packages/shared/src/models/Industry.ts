import mongoose, { Schema, model, type Model } from "mongoose";

export interface IIndustry {
  name: string;
  usedByCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const IndustrySchema = new Schema<IIndustry>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    usedByCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Industry: Model<IIndustry> = mongoose.models.Industry ?? model<IIndustry>("Industry", IndustrySchema);
