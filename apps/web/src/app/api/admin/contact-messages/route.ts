import { NextResponse } from "next/server";
import { connectToDatabase, ContactMessage, DemoRequest } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Admin-only inbox for /contact submissions — same shape and gating as the
 * Feedback Point Requests list (apps/web/src/app/api/admin/feedback-point-requests/route.ts),
 * scoped to the emailAndSiteContent permission since Contact messages are
 * marketing-site output, not tenant data. No per-business scoping applies
 * here (contact messages aren't tied to a business).
 */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const [messages, demos] = await Promise.all([
    ContactMessage.find().sort({ createdAt: -1 }),
    DemoRequest.find().sort({ createdAt: -1 }),
  ]);

  // "Book a demo" leads and /contact messages share one inbox, tagged by kind.
  const rows = [
    ...messages.map((m) => ({ kind: "contact" as const, m })),
    ...demos.map((m) => ({ kind: "demo" as const, m })),
  ]
    .map(({ kind, m }) => ({
      _id: m._id.toString(),
      kind,
      name: m.name,
      email: m.email,
      company: m.company,
      message: m.message,
      createdAt: m.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ status: "ok", messages: rows });
}
