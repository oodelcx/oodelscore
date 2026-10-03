import { NextResponse } from "next/server";
import { connectToDatabase, Event, FeedbackPoint } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * View-only for the Business portal, same as Feedback Points (see
 * ../feedback-points/route.ts): Events are Admin-managed so a business's
 * survey/session structure stays correctly configured — a business sees
 * its Events and how many feedback points/responses roll up under each.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [events, points] = await Promise.all([
    Event.find({ businessId: session.business._id }).sort({ createdAt: -1 }),
    FeedbackPoint.find({ businessId: session.business._id }).select("eventId").lean(),
  ]);

  const pointCountByEvent = new Map<string, number>();
  for (const point of points) {
    if (!point.eventId) continue;
    const key = point.eventId.toString();
    pointCountByEvent.set(key, (pointCountByEvent.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    status: "ok",
    events: events.map((e) => ({ ...e.toObject(), feedbackPointCount: pointCountByEvent.get(e._id.toString()) ?? 0 })),
  });
}
