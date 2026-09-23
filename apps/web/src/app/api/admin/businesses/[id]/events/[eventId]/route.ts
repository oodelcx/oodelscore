import { NextResponse } from "next/server";
import { connectToDatabase, Event, FeedbackPoint } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string; eventId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id, eventId } = await params;
  await connectToDatabase();
  const event = await Event.findOne({ _id: eventId, businessId: id });
  if (!event) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.name === "string" && body.name.trim()) event.name = body.name.trim();
  if (typeof body?.seriesKey === "string" && body.seriesKey.trim()) event.seriesKey = body.seriesKey.trim();
  if (typeof body?.facilitator === "string") event.facilitator = body.facilitator.trim();
  if (typeof body?.location === "string") event.location = body.location.trim();
  if (body?.startsAt === null || typeof body?.startsAt === "string") event.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body?.endsAt === null || typeof body?.endsAt === "string") event.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (body?.expectedAttendees === null || typeof body?.expectedAttendees === "number") event.expectedAttendees = body.expectedAttendees;

  await event.save();
  return NextResponse.json({ status: "ok", event });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id, eventId } = await params;
  await connectToDatabase();

  // Never delete an Event out from under FeedbackPoints that still point at
  // it — that would silently turn instance-based data back into orphaned
  // place-based data. Unlink them first from the Feedback Points screen.
  const linkedCount = await FeedbackPoint.countDocuments({ eventId, businessId: id });
  if (linkedCount > 0) {
    return NextResponse.json(
      { status: "error", message: `${linkedCount} feedback point(s) still use this event — remove or reassign them first` },
      { status: 400 }
    );
  }

  const removed = await Event.findOneAndDelete({ _id: eventId, businessId: id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
