import { NextResponse } from "next/server";
import { connectToDatabase, ContactMessage } from "@oodelscore/shared";
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
  const messages = await ContactMessage.find().sort({ createdAt: -1 });

  return NextResponse.json({
    status: "ok",
    messages: messages.map((m) => ({
      _id: m._id.toString(),
      name: m.name,
      email: m.email,
      company: m.company,
      message: m.message,
      createdAt: m.createdAt,
    })),
  });
}
