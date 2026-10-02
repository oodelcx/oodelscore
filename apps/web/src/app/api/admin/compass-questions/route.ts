import { NextResponse } from "next/server";
import { connectToDatabase, CompassQuestion, ANCHOR_DIMENSIONS, COMPASS_QUESTION_VARIANTS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const DIMENSION_SET: readonly string[] = ANCHOR_DIMENSIONS;
const VARIANT_SET: readonly string[] = COMPASS_QUESTION_VARIANTS;

/**
 * Admin CRUD for OodelCX Compass's ANCHOR question bank (replaces the old
 * hardcoded questionBank.ts array). Gated on the same `questionTemplates`
 * permission the Industries/old Compass Content pages used — this is the
 * same kind of "assessment content configuration" that key reserves for
 * Admin. The six ANCHOR dimensions and the gate-based scoring stay fixed;
 * only the question text, which dimension/variant a question belongs to,
 * and its order within that group are editable here.
 */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const questions = await CompassQuestion.find().sort({ dimension: 1, variant: 1, order: 1 });
  return NextResponse.json({ status: "ok", questions });
}

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const dimension = typeof body?.dimension === "string" ? body.dimension : "";
  const variant = typeof body?.variant === "string" ? body.variant : "shared";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!DIMENSION_SET.includes(dimension)) {
    return NextResponse.json({ status: "error", message: "Invalid dimension" }, { status: 400 });
  }
  if (!VARIANT_SET.includes(variant)) {
    return NextResponse.json({ status: "error", message: "Invalid variant" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ status: "error", message: "Question text is required" }, { status: 400 });
  }

  await connectToDatabase();
  const siblingCount = await CompassQuestion.countDocuments({ dimension, variant });
  // Key only needs to be unique and stable — not meaningful to anything
  // outside this record, so a timestamp suffix avoids any collision risk
  // with a question an admin renamed/re-added under the same dimension.
  const key = `${dimension}_${variant}_${Date.now()}`;
  const question = await CompassQuestion.create({ key, dimension, variant, text, order: siblingCount });

  return NextResponse.json({ status: "ok", question }, { status: 201 });
}
