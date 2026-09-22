import { NextResponse } from "next/server";
import { connectToDatabase, SupportTicket, SUPPORT_TICKET_CATEGORIES, sendTemplatedEmail } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

const CATEGORY_SET: readonly string[] = SUPPORT_TICKET_CATEGORIES;

/**
 * A channel to report a problem with OodelCX itself (billing, a bug,
 * access) — separate from Messages (a static "here's who to contact"
 * card) and unrelated to this business's own customer feedback.
 */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const tickets = await SupportTicket.find({ ownerType: "business", ownerId: session.business._id }).sort({ createdAt: -1 });
  return NextResponse.json({ status: "ok", tickets });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const ticketBody = typeof body?.body === "string" ? body.body.trim() : "";

  if (!CATEGORY_SET.includes(category)) {
    return NextResponse.json({ status: "error", message: "A valid category is required" }, { status: 400 });
  }
  if (!subject) return NextResponse.json({ status: "error", message: "Subject is required" }, { status: 400 });
  if (!ticketBody) return NextResponse.json({ status: "error", message: "Description is required" }, { status: 400 });

  await connectToDatabase();
  const ticket = await SupportTicket.create({
    ownerType: "business",
    ownerId: session.business._id,
    ownerName: session.business.name,
    submittedByUserId: session.user._id,
    submittedByEmail: session.user.email,
    category,
    subject,
    body: ticketBody,
  });

  const notifyTo = process.env.SUPPORT_QUEUE_NOTIFY_EMAIL ?? process.env.CONTACT_FORM_NOTIFY_EMAIL ?? "hello@oodelscore.com";
  const appUrl = process.env.APP_URL ?? "";
  await sendTemplatedEmail("support_ticket_created", notifyTo, {
    account_name: session.business.name,
    submitter_email: session.user.email,
    category,
    subject,
    body: ticketBody,
    ticket_link: appUrl ? `${appUrl}/admin/support-queue` : "/admin/support-queue",
  }).catch((err) => console.error("[support-tickets] notification email failed", err));

  return NextResponse.json({ status: "ok", ticket }, { status: 201 });
}
