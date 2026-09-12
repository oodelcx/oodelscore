import mongoose, { Schema, model, type Model } from "mongoose";

export interface IDemoRequest {
  name: string;
  email: string;
  company: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const DemoRequestSchema = new Schema<IDemoRequest>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    company: { type: String, default: "", trim: true },
    message: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export const DemoRequest: Model<IDemoRequest> =
  mongoose.models.DemoRequest ?? model<IDemoRequest>("DemoRequest", DemoRequestSchema);
