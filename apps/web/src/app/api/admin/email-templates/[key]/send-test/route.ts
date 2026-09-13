import { NextResponse } from "next/server";
import { EMAIL_TEMPLATE_KEYS, sendRawEmail } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ key: string }> };

const KEY_SET: readonly string[] = EMAIL_TEMPLATE_KEYS;

// Same example merge-var values the editor's live preview renders with
// (mockup: modal-send-test — "Sends via Resend using the current draft and
// example data").
const EXAMPLE_VARS: Record<string, string> = {
  name: "Amara",
  email: "amara@meridianretail.com",
  inviter_name: "Jordan",
  business_name: "Meridian Retail",
  set_password_link: "https://oodelscore.com/set-password/…",
  reset_link: "https://oodelscore.com/reset/…",
  alert_condition: "Avg score dropped below 3.0",
  alert_link: "https://oodelscore.com/business/alert-rules",
  report_period: "August",
  report_link: "https://oodelscore.com/business/insights",
  action_title: "Follow up with kitchen team",
  due_date: "Sep 20",
  action_link: "https://oodelscore.com/group/action-board",
  invoice_amount: "£249.00",
  billing_link: "https://oodelscore.com/business/billing",
  requester_name: "Priya Shah",
  requester_email: "priya@northgateretail.com",
  requester_company: "Northgate Retail",
  requester_message: "We run 40 locations and want to see the Group dashboard.",
};

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { key } = await params;
  if (!KEY_SET.includes(key)) {
    return NextResponse.json({ status: "error", message: "Unknown template" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const emailBody = typeof body?.body === "string" ? body.body : "";
  if (!to) return NextResponse.json({ status: "error", message: "Recipient email is required" }, { status: 400 });

  try {
    await sendRawEmail(to, subject, emailBody, EXAMPLE_VARS);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send test email";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }

  return NextResponse.json({ status: "ok" });
}
