import mongoose, { Schema, model, type Model } from "mongoose";

export interface ICategory {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

export const Category: Model<ICategory> = mongoose.models.Category ?? model<ICategory>("Category", CategorySchema);
