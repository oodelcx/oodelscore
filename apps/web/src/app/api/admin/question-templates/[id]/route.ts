import { NextResponse } from "next/server";
import { connectToDatabase, QuestionTemplate, Business, QUESTION_TYPES } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const QUESTION_TYPE_SET: readonly string[] = QUESTION_TYPES;

type RouteParams = { params: Promise<{ id: string }> };

function validateQuestions(questions: unknown): string | null {
  if (!Array.isArray(questions)) return "questions must be an array";
  for (const q of questions) {
    if (!q || typeof q !== "object") return "each question must be an object";
    const question = q as Record<string, unknown>;
    if (typeof question.text !== "string" || !question.text.trim()) return "each question needs text";
    if (typeof question.type !== "string" || !QUESTION_TYPE_SET.includes(question.type)) {
      return `invalid question type: ${String(question.type)}`;
    }
  }
  return null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  const template = await QuestionTemplate.findById(id);
  if (!template) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const usedByCount = await Business.countDocuments({ questionTemplateId: id });

  return NextResponse.json({ status: "ok", template: { ...template.toObject(), usedByCount } });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
  }

  if (body.questions !== undefined) {
    const questionsError = validateQuestions(body.questions);
    if (questionsError) {
      return NextResponse.json({ status: "error", message: questionsError }, { status: 400 });
    }
  }

  await connectToDatabase();
  const template = await QuestionTemplate.findById(id);
  if (!template) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  if (typeof body.name === "string" && body.name.trim()) template.name = body.name.trim();
  if (Array.isArray(body.suggestedIndustries)) template.suggestedIndustries = body.suggestedIndustries;
  if (Array.isArray(body.questions)) template.questions = body.questions;

  await template.save();
  return NextResponse.json({ status: "ok", template });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.delete) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();

  const usedByCount = await Business.countDocuments({ questionTemplateId: id });
  if (usedByCount > 0) {
    return NextResponse.json(
      {
        status: "error",
        message: `Used by ${usedByCount} business(es) — reassign them to a different template first.`,
      },
      { status: 409 }
    );
  }

  const template = await QuestionTemplate.findByIdAndDelete(id);
  if (!template) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
