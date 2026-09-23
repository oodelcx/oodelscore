import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectToDatabase, FeedbackPoint, Event, FORM_LAYOUTS, DEMOGRAPHIC_MODES } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const DEMOGRAPHIC_MODE_SET: readonly string[] = DEMOGRAPHIC_MODES;
const DEMOGRAPHIC_FIELDS = ["name", "email", "phone", "ageGroup", "gender"] as const;

type RouteParams = { params: Promise<{ id: string; fpId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id, fpId } = await params;
  await connectToDatabase();
  const feedbackPoint = await FeedbackPoint.findOne({ _id: fpId, businessId: id });
  if (!feedbackPoint) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.name === "string") feedbackPoint.name = body.name;
  if (typeof body?.description === "string") feedbackPoint.description = body.description;
  if (typeof body?.active === "boolean") feedbackPoint.active = body.active;
  if (typeof body?.eventId === "string" || body?.eventId === null) {
    if (body.eventId) {
      const event = await Event.findOne({ _id: body.eventId, businessId: id });
      if (!event) return NextResponse.json({ status: "error", message: "Event not found for this business" }, { status: 400 });
    }
    feedbackPoint.eventId = body.eventId || null;
  }
  if (body?.startsAt === null || typeof body?.startsAt === "string") feedbackPoint.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body?.endsAt === null || typeof body?.endsAt === "string") feedbackPoint.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (typeof body?.questionTemplateOverride === "string" || body?.questionTemplateOverride === null) {
    feedbackPoint.questionTemplateOverride = body.questionTemplateOverride || null;
  }
  if (body?.formLayoutOverride === null || (FORM_LAYOUTS as readonly string[]).includes(body?.formLayoutOverride)) {
    feedbackPoint.formLayoutOverride = body.formLayoutOverride;
  }
  if (body?.demographicOverride === null) {
    feedbackPoint.demographicOverride = null;
  } else if (body?.demographicOverride && typeof body.demographicOverride === "object") {
    const base = feedbackPoint.demographicOverride ?? {
      name: "off",
      email: "optional",
      phone: "off",
      ageGroup: "optional",
      gender: "optional",
    };
    const override = { ...base };
    for (const field of DEMOGRAPHIC_FIELDS) {
      const value = body.demographicOverride[field];
      if (typeof value === "string" && DEMOGRAPHIC_MODE_SET.includes(value)) {
        override[field] = value as (typeof override)[typeof field];
      }
    }
    feedbackPoint.demographicOverride = override;
  }

  // Spec Section 2 (feedbackPoints): the only action that produces a NEW QR
  // for the same point is an explicit regenerate — it replaces qrToken,
  // immediately invalidating any printed poster using the old one. This is
  // never bundled into a routine edit; it only happens when the caller asks.
  let regenerated = false;
  if (body?.regenerateQr === true) {
    feedbackPoint.qrToken = randomBytes(16).toString("hex");
    regenerated = true;
  }

  await feedbackPoint.save();

  return NextResponse.json({ status: "ok", feedbackPoint, regenerated });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id, fpId } = await params;
  await connectToDatabase();
  const removed = await FeedbackPoint.findOneAndDelete({ _id: fpId, businessId: id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
