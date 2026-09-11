import { Schema, model, models, type Model } from "mongoose";

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

export const Category: Model<ICategory> = models.Category ?? model<ICategory>("Category", CategorySchema);
