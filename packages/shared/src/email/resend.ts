import { EmailTemplate, type EmailTemplateKey } from "../models/EmailTemplate";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Oodel Score <noreply@oodelscore.com>";

function substituteMergeVars(text: string, vars: Record<string, string>): string {
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key: string) => vars[key] ?? match);
}

/**
 * Loads the given template from `emailTemplates` (Admin-editable, spec
 * Section 11), substitutes {{merge_vars}}, and sends via Resend's HTTP API.
 *
 * Callers are responsible for confirming a real send is intended — per the
 * project's working agreement, never call this against a non-test address
 * without explicit confirmation outside of a sandbox/test environment.
 */
export async function sendTemplatedEmail(
  key: EmailTemplateKey,
  to: string,
  vars: Record<string, string>
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const template = await EmailTemplate.findOne({ key });
  if (!template) {
    throw new Error(`No email template seeded for key "${key}"`);
  }

  const subject = substituteMergeVars(template.subject, vars);
  const body = substituteMergeVars(template.body, vars);

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
      to: [to],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${errorBody}`);
  }
}
