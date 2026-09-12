import { NextResponse } from "next/server";
import { connectToDatabase, DemoRequest, sendTemplatedEmail } from "@oodelscore/shared";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Public: the marketing site's "Book a demo" modal. Always stores the lead
 * even if the internal notification email fails to send (e.g. RESEND_API_KEY
 * not configured yet) — losing a lead is worse than a missed email.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!name) return NextResponse.json({ status: "error", message: "Name is required" }, { status: 400 });
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ status: "error", message: "A valid email is required" }, { status: 400 });
  }

  await connectToDatabase();
  await DemoRequest.create({ name, email, company, message });

  const notifyTo = process.env.DEMO_REQUEST_NOTIFY_EMAIL ?? "hello@oodelscore.com";
  await sendTemplatedEmail("demo_request", notifyTo, {
    requester_name: name,
    requester_email: email,
    requester_company: company || "(no company given)",
    requester_message: message || "(no message)",
  }).catch((err) => console.error("[demo-requests] notification email failed", err));

  return NextResponse.json({ status: "ok" }, { status: 201 });
}
