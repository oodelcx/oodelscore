import { NextResponse } from "next/server";
import { connectToDatabase, Business, Event } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

function slugifySeriesKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Events are Admin-managed, same as FeedbackPoint creation (see
 * ../feedback-points/route.ts) — a business only ever views its Events
 * read-only via /api/business/events.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const events = await Event.find({ businessId: id }).sort({ createdAt: -1 });
  return NextResponse.json({ status: "ok", events });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  const business = await Business.findById(id);
  if (!business) return NextResponse.json({ status: "error", message: "Business not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ status: "error", message: "Name is required" }, { status: 400 });

  const seriesKey = typeof body?.seriesKey === "string" && body.seriesKey.trim() ? slugifySeriesKey(body.seriesKey) : slugifySeriesKey(name);

  const event = await Event.create({
    businessId: id,
    name,
    seriesKey,
    facilitator: typeof body?.facilitator === "string" ? body.facilitator.trim() : "",
    location: typeof body?.location === "string" ? body.location.trim() : "",
    startsAt: body?.startsAt ? new Date(body.startsAt) : null,
    endsAt: body?.endsAt ? new Date(body.endsAt) : null,
    expectedAttendees: typeof body?.expectedAttendees === "number" ? body.expectedAttendees : null,
  });

  return NextResponse.json({ status: "ok", event }, { status: 201 });
}
