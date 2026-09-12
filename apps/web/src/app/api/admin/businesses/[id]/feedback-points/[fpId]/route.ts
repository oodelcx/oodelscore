import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint, FORM_LAYOUTS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

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
  if (typeof body?.questionTemplateOverride === "string" || body?.questionTemplateOverride === null) {
    feedbackPoint.questionTemplateOverride = body.questionTemplateOverride;
  }
  if (body?.formLayoutOverride === null || (FORM_LAYOUTS as readonly string[]).includes(body?.formLayoutOverride)) {
    feedbackPoint.formLayoutOverride = body.formLayoutOverride;
  }
  await feedbackPoint.save();

  return NextResponse.json({ status: "ok", feedbackPoint });
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
