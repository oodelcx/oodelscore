import { NextResponse } from "next/server";
import { connectToDatabase, CompassQuestion, ANCHOR_DIMENSIONS, COMPASS_QUESTION_VARIANTS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const DIMENSION_SET: readonly string[] = ANCHOR_DIMENSIONS;
const VARIANT_SET: readonly string[] = COMPASS_QUESTION_VARIANTS;

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const update: Record<string, string | number> = {};
  if (body?.dimension !== undefined) {
    if (!DIMENSION_SET.includes(body.dimension)) {
      return NextResponse.json({ status: "error", message: "Invalid dimension" }, { status: 400 });
    }
    update.dimension = body.dimension;
  }
  if (body?.variant !== undefined) {
    if (!VARIANT_SET.includes(body.variant)) {
      return NextResponse.json({ status: "error", message: "Invalid variant" }, { status: 400 });
    }
    update.variant = body.variant;
  }
  if (body?.text !== undefined) {
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ status: "error", message: "Question text is required" }, { status: 400 });
    }
    update.text = body.text.trim();
  }
  if (body?.order !== undefined) {
    if (typeof body.order !== "number") {
      return NextResponse.json({ status: "error", message: "order must be a number" }, { status: 400 });
    }
    update.order = body.order;
  }

  await connectToDatabase();
  const question = await CompassQuestion.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!question) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok", question });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.delete) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  await CompassQuestion.findByIdAndDelete(id);

  return NextResponse.json({ status: "ok" });
}
