import type { EmailTemplateKey } from "../models/EmailTemplate";

interface SeedEmailTemplate {
  key: EmailTemplateKey;
  subject: string;
  body: string;
  availableVars: string[];
}

// Default copy per spec Section 11's trigger table. Content is a starting
// point — final wording is edited from Admin -> Email Templates, not here.
export const SEED_EMAIL_TEMPLATES: SeedEmailTemplate[] = [
  {
    key: "welcome",
    subject: "Welcome to OodelCX — set your password",
    body: "Hi {{name}}, an OodelCX account was created for {{email}}. Set your password to get started: {{set_password_link}}",
    availableVars: ["name", "email", "set_password_link"],
  },
  {
    key: "email_changed",
    subject: "Your OodelCX login email was changed",
    body: "Hi {{name}}, your login email is now {{email}}. If you didn't make this change, contact us right away.",
    availableVars: ["name", "email"],
  },
  {
    key: "password_reset",
    subject: "Reset your OodelCX password",
    body: "Hi {{name}}, use this link to reset your password: {{reset_link}}",
    availableVars: ["name", "reset_link"],
  },
  {
    key: "invite_to_team",
    subject: "{{inviter_name}} invited you to {{business_name}} on OodelCX",
    body: "Hi {{name}}, {{inviter_name}} invited you to join {{business_name}} on OodelCX. Set your password to get started: {{set_password_link}}",
    availableVars: ["name", "inviter_name", "business_name", "set_password_link"],
  },
  {
    key: "alert_notification",
    subject: "Alert triggered for {{business_name}}",
    body: "Hi {{name}}, an alert fired for {{business_name}}: {{alert_condition}}. View details: {{alert_link}}",
    availableVars: ["name", "business_name", "alert_condition", "alert_link"],
  },
  {
    key: "report_ready",
    subject: "Your {{report_period}} Insights report is ready",
    body: "Hi {{name}}, the {{report_period}} Insights report for {{business_name}} is ready: {{report_link}}",
    availableVars: ["name", "report_period", "business_name", "report_link"],
  },
  {
    key: "action_assigned",
    subject: "You've been assigned: {{action_title}}",
    body: "Hi {{name}}, you've been assigned an action item: {{action_title}}, due {{due_date}}. View it here: {{action_link}}",
    availableVars: ["name", "action_title", "due_date", "action_link"],
  },
  {
    key: "action_comment_added",
    subject: "New comment on: {{action_title}}",
    body: "Hi {{name}}, {{commenter_name}} commented on an action item you're involved in: {{action_title}}.\n\n\"{{comment_body}}\"\n\nView it here: {{action_link}}",
    availableVars: ["name", "commenter_name", "action_title", "comment_body", "action_link"],
  },
  {
    key: "item_escalated",
    subject: "Escalated: {{action_title}}",
    body: "Hi {{name}}, {{escalator_name}} at {{org_name}} escalated an action item at {{business_name}}: {{action_title}}.\n\n{{escalation_note}}\n\nView it here: {{action_link}}",
    availableVars: ["name", "escalator_name", "org_name", "business_name", "action_title", "escalation_note", "action_link"],
  },
  {
    key: "case_escalated_to_org",
    subject: "Escalated for your attention: {{action_title}}",
    body: "Hi {{name}}, {{escalator_name}} at {{business_name}} escalated a case to {{org_name}} for your attention: {{action_title}}.\n\n{{escalation_note}}\n\nView it here: {{action_link}}",
    availableVars: ["name", "escalator_name", "business_name", "org_name", "action_title", "escalation_note", "action_link"],
  },
  {
    key: "case_escalated",
    subject: "Escalated to you ({{level_label}}): {{action_title}}",
    body: "Hi {{name}}, a case at {{business_name}} has been escalated to you as {{level_label}}: {{action_title}}.\n\n{{escalation_note}}\n\nView it here: {{action_link}}",
    availableVars: ["name", "level_label", "business_name", "action_title", "escalation_note", "action_link"],
  },
  {
    key: "invoice_receipt",
    subject: "Your OodelCX payment receipt",
    body: "Hi {{name}}, we've received your payment of {{invoice_amount}}. Thank you.",
    availableVars: ["name", "invoice_amount"],
  },
  {
    key: "payment_failed",
    subject: "Payment failed for {{business_name}}",
    body: "Hi {{name}}, a payment for {{business_name}} failed. Please update your payment method: {{billing_link}}",
    availableVars: ["name", "business_name", "billing_link"],
  },
  {
    key: "comp_expiry_reminder",
    subject: "{{account_name}}'s pilot expires {{expires_on}}",
    body: "Hi {{name}}, {{account_name}}'s comp/pilot period expires on {{expires_on}}. If they're continuing, enable checkout or start a real subscription before then: {{account_link}}",
    availableVars: ["name", "account_name", "expires_on", "account_link"],
  },
  {
    key: "customer_response",
    subject: "A response from {{business_name}}",
    body: "Hi {{respondent_name}}, thank you for your feedback. {{message_body}}\n\n— {{business_name}}",
    availableVars: ["respondent_name", "business_name", "message_body"],
  },
  {
    key: "demo_request",
    subject: "New demo request: {{requester_name}}",
    body: "{{requester_name}} ({{requester_email}}) at {{requester_company}} asked for a demo.\n\nMessage: {{requester_message}}",
    availableVars: ["requester_name", "requester_email", "requester_company", "requester_message"],
  },
  {
    key: "contact_form_submission",
    subject: "New contact form message: {{sender_name}}",
    body: "{{sender_name}} ({{sender_email}}) at {{sender_company}} sent a message via the Contact page.\n\nMessage: {{sender_message}}",
    availableVars: ["sender_name", "sender_email", "sender_company", "sender_message"],
  },
  {
    key: "feedback_point_request",
    subject: "New feedback point request from {{business_name}}",
    body: "{{business_name}} ({{requester_email}}) requested a new feedback point.\n\nNote: {{note}}",
    availableVars: ["business_name", "requester_email", "note"],
  },
  {
    key: "decision_outcome_measured",
    subject: "Outcome measured: {{decision_title}} — {{verdict}}",
    body: "Hi {{name}}, the decision \"{{decision_title}}\" has a measured outcome: {{verdict}}. {{metric_label}} went from {{outcome_before}} to {{outcome_after}}. View it here: {{decision_link}}",
    availableVars: ["name", "decision_title", "verdict", "metric_label", "outcome_before", "outcome_after", "decision_link"],
  },
];
