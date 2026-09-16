import mongoose, { Schema, model, type Model } from "mongoose";

/**
 * Submissions from the public /contact page. Deliberately mirrors
 * DemoRequest's shape (name/email/company/message, no status/review
 * workflow) — DemoRequest has no status field either, so there's nothing
 * worth carrying over here; a simple inbox is enough for now.
 */
export interface IContactMessage {
  name: string;
  email: string;
  company: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    company: { type: String, default: "", trim: true },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const ContactMessage: Model<IContactMessage> =
  mongoose.models.ContactMessage ?? model<IContactMessage>("ContactMessage", ContactMessageSchema);
