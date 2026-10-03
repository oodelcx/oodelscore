import { NextResponse } from "next/server";
import { connectToDatabase, SupportTicket, SUPPORT_TICKET_CATEGORIES, sendTemplatedEmail, User } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

const CATEGORY_SET: readonly string[] = SUPPORT_TICKET_CATEGORIES;

/**
 * A channel to report a problem with OodelCX itself (billing, a bug,
 * access) — separate from Messages (a static "here's who to contact"
 * card) and unrelated to this business's own customer feedback.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "support" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const tickets = await SupportTicket.find({ ownerType: "business", ownerId: session.business._id }).sort({ createdAt: -1 });
  return NextResponse.json({ status: "ok", tickets });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "support" });
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

  const appUrl = process.env.APP_URL ?? "";
  if (category === "feedback_point_request") {
    // A feedback point request has always routed to this business's own
    // account manager first (they know the account/survey history), falling
    // back to the generic admin inbox only when none is assigned — unlike
    // every other ticket category, which always goes to the flat support
    // queue inbox.
    let notifyTo = process.env.ADMIN_NOTIFICATION_EMAIL ?? "hello@oodelscore.com";
    if (session.business.accountManagerId) {
      const manager = await User.findById(session.business.accountManagerId);
      if (manager?.email) notifyTo = manager.email;
    }
    await sendTemplatedEmail("feedback_point_request", notifyTo, {
      business_name: session.business.name,
      requester_email: session.user.email,
      note: ticketBody,
    }).catch((err) => console.error("[support-tickets] feedback_point_request notification failed", err));
  } else {
    const notifyTo = process.env.SUPPORT_QUEUE_NOTIFY_EMAIL ?? process.env.CONTACT_FORM_NOTIFY_EMAIL ?? "hello@oodelscore.com";
    await sendTemplatedEmail("support_ticket_created", notifyTo, {
      account_name: session.business.name,
      submitter_email: session.user.email,
      category,
      subject,
      body: ticketBody,
      ticket_link: appUrl ? `${appUrl}/admin/support-queue` : "/admin/support-queue",
    }).catch((err) => console.error("[support-tickets] notification email failed", err));
  }

  return NextResponse.json({ status: "ok", ticket }, { status: 201 });
}
