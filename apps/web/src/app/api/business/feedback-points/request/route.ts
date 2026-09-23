import { NextResponse } from "next/server";
import { connectToDatabase, User, FeedbackPointRequest, sendTemplatedEmail } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * A business can't create its own feedback points (Admin/account-manager
 * only, per the mockup and /api/admin/businesses/[id]/feedback-points) — this
 * is the real path for a business to ask for a new one or a change to an
 * existing one. Persists a record (so it shows up as a real in-app
 * "needs attention" item for Admin/the assigned account manager, not just
 * an easy-to-miss email) and notifies the assigned account manager, or a
 * fallback inbox if none is assigned yet.
 */
export async function POST(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  await connectToDatabase();

  await FeedbackPointRequest.create({
    businessId: session.business._id,
    requestedByUserId: session.user._id,
    note,
  });

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
    // The in-app record above is the primary notification path now — don't
    // fail the whole request just because the email couldn't be sent.
    console.error("[feedback-points/request] notification email failed", err);
  }

  return NextResponse.json({ status: "ok" });
}
