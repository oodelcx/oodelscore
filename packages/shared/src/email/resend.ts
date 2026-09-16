import type { Types } from "mongoose";
import { EmailTemplate, type EmailTemplateKey } from "../models/EmailTemplate";
import { User } from "../models/User";
import type { BillingOwnerType } from "../models/BillingSubscription";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "OodelCX <noreply@oodelscore.com>";

export function substituteMergeVars(text: string, vars: Record<string, string>): string {
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key: string) => vars[key] ?? match);
}

/**
 * Sends arbitrary subject/body straight to Resend, substituting
 * {{merge_vars}} — used for Admin's "Send test email" (mockup:
 * modal-send-test), which must reflect whatever is currently in the editor
 * draft, not necessarily what's saved to `emailTemplates` yet.
 */
export async function sendRawEmail(to: string, subject: string, body: string, vars: Record<string, string>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
      to: [to],
      subject: substituteMergeVars(subject, vars),
      text: substituteMergeVars(body, vars),
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${errorBody}`);
  }
}

/**
 * Resolves the login email for a `BillingOwnerType`-keyed owner ("business"
 * or "parentOrg") — same account-lookup the rest of the codebase already
 * uses (see e.g. cxpulse/compute.ts's computeCxPulseForOwner, or
 * group/action-board/[id]/route.ts's escalation recipient). Used wherever a
 * notification needs to reach whoever logs into that account, keyed off the
 * same ownerType/ownerId pair AiInsightReport and BillingSubscription use.
 * Returns null if no login exists yet for that owner (e.g. account not
 * fully set up) — callers should just skip the send in that case.
 */
export async function resolveOwnerLoginEmail(ownerType: BillingOwnerType, ownerId: Types.ObjectId | string): Promise<string | null> {
  const accountType = ownerType === "business" ? "business" : "parent_org";
  const owner = await User.findOne({ accountType, parentId: ownerId }).select("email");
  return owner?.email ?? null;
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
