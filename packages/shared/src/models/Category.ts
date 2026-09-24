import mongoose, { Schema, model, type Model } from "mongoose";
import { PRODUCTS, type Product } from "./products";

export interface ICategory {
  name: string;
  // Which product this category belongs to — defaults to customer_experience
  // so every category that predates Colleague Experience is unaffected.
  // Uniqueness is scoped per product (see compound index below), not global,
  // so "Communication" can exist once for each product without colliding.
  product: Product;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
  },
  { timestamps: true }
);

CategorySchema.index({ name: 1, product: 1 }, { unique: true });
// NOTE: the collection's old single-field unique index on `name` (from
// before Colleague Experience existed) still needs dropping in each real
// database when this ships — Mongoose only creates missing indexes, it
// never drops a stale one. Until that's done the old index still silently
// enforces global name uniqueness, which is stricter than needed but not
// unsafe. Run Category.syncIndexes() (or drop it manually) once deployed.

export const Category: Model<ICategory> = mongoose.models.Category ?? model<ICategory>("Category", CategorySchema);
