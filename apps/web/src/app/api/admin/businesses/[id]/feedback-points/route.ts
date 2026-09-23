import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectToDatabase, FeedbackPoint, Business, Event, FORM_LAYOUTS, DEMOGRAPHIC_MODES } from "@oodelscore/shared";

const DEMOGRAPHIC_MODE_SET: readonly string[] = DEMOGRAPHIC_MODES;
const DEMOGRAPHIC_FIELDS = ["name", "email", "phone", "ageGroup", "gender"] as const;
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Feedback Points are Admin/account-manager managed (per the mockup:
 * businesses view them read-only and "request" changes, they don't
 * self-serve create) — this is the real creation path.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const points = await FeedbackPoint.find({ businessId: id }).sort({ createdAt: 1 });
  return NextResponse.json({ status: "ok", feedbackPoints: points });
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

  const existingCount = await FeedbackPoint.countDocuments({ businessId: id });
  if (existingCount >= business.maxFeedbackPoints) {
    return NextResponse.json(
      { status: "error", message: `This business's plan allows up to ${business.maxFeedbackPoints} feedback point(s)` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ status: "error", message: "Name is required" }, { status: 400 });

  let eventId: string | null = null;
  if (typeof body?.eventId === "string" && body.eventId) {
    const event = await Event.findOne({ _id: body.eventId, businessId: id });
    if (!event) return NextResponse.json({ status: "error", message: "Event not found for this business" }, { status: 400 });
    eventId = body.eventId;
  }

  const formLayoutOverride = (FORM_LAYOUTS as readonly string[]).includes(body?.formLayoutOverride) ? body.formLayoutOverride : null;

  let demographicOverride = null;
  if (body?.demographicOverride && typeof body.demographicOverride === "object") {
    const base = { name: "off", email: "optional", phone: "off", ageGroup: "optional", gender: "optional" };
    const override = { ...base };
    for (const field of DEMOGRAPHIC_FIELDS) {
      const value = body.demographicOverride[field];
      if (typeof value === "string" && DEMOGRAPHIC_MODE_SET.includes(value)) {
        override[field] = value as (typeof override)[typeof field];
      }
    }
    demographicOverride = override;
  }

  const feedbackPoint = await FeedbackPoint.create({
    businessId: id,
    eventId,
    name,
    description: typeof body?.description === "string" ? body.description : "",
    qrToken: randomBytes(16).toString("hex"),
    questionTemplateOverride: typeof body?.questionTemplateOverride === "string" ? body.questionTemplateOverride : null,
    formLayoutOverride,
    demographicOverride,
    startsAt: body?.startsAt ? new Date(body.startsAt) : null,
    endsAt: body?.endsAt ? new Date(body.endsAt) : null,
  });

  return NextResponse.json({ status: "ok", feedbackPoint }, { status: 201 });
}
