import mongoose, { Schema, model, type Model } from "mongoose";

export const EMAIL_TEMPLATE_KEYS = [
  "welcome",
  "email_changed",
  "password_reset",
  "invite_to_team",
  "alert_notification",
  "report_ready",
  "action_assigned",
  "action_comment_added",
  "item_escalated",
  "case_escalated_to_org",
  "invoice_receipt",
  "payment_failed",
  "demo_request",
  "contact_form_submission",
  "feedback_point_request",
  "decision_outcome_measured",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface IEmailTemplate {
  key: EmailTemplateKey;
  subject: string;
  body: string; // supports {{merge_vars}}
  availableVars: string[];
  lastEditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>(
  {
    key: { type: String, enum: EMAIL_TEMPLATE_KEYS, required: true, unique: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    availableVars: { type: [String], default: [] },
    lastEditedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const EmailTemplate: Model<IEmailTemplate> =
  mongoose.models.EmailTemplate ?? model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema);
