import { NextResponse } from "next/server";
import { connectToDatabase, User, sendTemplatedEmail } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * A business can't create its own feedback points (Admin/account-manager
 * only, per the mockup and /api/admin/businesses/[id]/feedback-points) — this
 * is the real path for a business to ask for a new one or a change to an
 * existing one. Notifies the business's assigned account manager, or a
 * fallback inbox if none is assigned yet.
 */
export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  await connectToDatabase();

  let notifyTo = process.env.ADMIN_NOTIFICATION_EMAIL ?? "hello@oodelscore.com";
  if (session.business.accountManagerId) {
    const manager = await User.findById(session.business.accountManagerId);
    if (manager?.email) notifyTo = manager.email;
  }

  try {
    await sendTemplatedEmail("feedback_point_request", notifyTo, {
      business_name: session.business.name,
      requester_email: session.user.email,
      note: note || "(no note given)",
    });
  } catch (err) {
    console.error("[feedback-points/request] notification email failed", err);
    return NextResponse.json({ status: "error", message: "Couldn't send your request. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ status: "ok" });
}
