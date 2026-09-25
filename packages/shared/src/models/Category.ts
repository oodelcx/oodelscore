import mongoose, { Schema, model, type Model } from "mongoose";
import { PRODUCTS, type Product } from "./products";

export interface ICategory {
  name: string;
  // Which product this category belongs to — defaults to customer_experience
  // so every category that predates Colleague Experience is unaffected.
  // Uniqueness is scoped per product (see compound index below), not global,
  // so "Communication" can exist once for each product without colliding.
  product: Product;
  // Colleague Experience only. A sensitive category (HR complaints,
  // leadership/management concerns) bypasses the normal
  // CategoryOwnerMapping routing — see evaluate.ts's autoTriageAndCreate
  // ActionItem — and goes instead to the business/org's designated
  // sensitiveRoutingContactId, so a complaint about HR never lands with HR.
  sensitive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
    sensitive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CategorySchema.index({ name: 1, product: 1 }, { unique: true });
// The collection's old single-field unique index on `name` (from before
// Colleague Experience existed) enforces global name uniqueness, which is
// stricter than needed but not unsafe. connectToDatabase() now runs
// Category.syncIndexes() once per process on connect, so this self-heals
// in every environment rather than needing a manual drop.

export const Category: Model<ICategory> = mongoose.models.Category ?? model<ICategory>("Category", CategorySchema);
