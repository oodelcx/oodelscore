import { NextResponse } from "next/server";
import { connectToDatabase, QuestionTemplate, Business, QUESTION_TYPES } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const QUESTION_TYPE_SET: readonly string[] = QUESTION_TYPES;

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

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const templates = await QuestionTemplate.find().sort({ name: 1 });

  // usedByCount is denormalized per spec Section 6 ("recompute on business
  // save"), but nothing recomputes it yet since Business writes don't
  // trigger it — compute live here instead of trusting a possibly-stale
  // stored value, until that recompute step exists.
  const usageCounts = await Business.aggregate<{ _id: string; count: number }>([
    { $match: { questionTemplateId: { $ne: null } } },
    { $group: { _id: "$questionTemplateId", count: { $sum: 1 } } },
  ]);
  const usageByTemplateId = new Map(usageCounts.map((u) => [u._id.toString(), u.count]));

  const templatesWithUsage = templates.map((t) => ({
    ...t.toObject(),
    usedByCount: usageByTemplateId.get(t._id.toString()) ?? 0,
  }));

  return NextResponse.json({ status: "ok", templates: templatesWithUsage });
}

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ status: "error", message: "name is required" }, { status: 400 });
  }

  const questionsError = validateQuestions(body.questions ?? []);
  if (questionsError) {
    return NextResponse.json({ status: "error", message: questionsError }, { status: 400 });
  }

  await connectToDatabase();
  const template = await QuestionTemplate.create({
    name: body.name.trim(),
    suggestedIndustries: Array.isArray(body.suggestedIndustries) ? body.suggestedIndustries : [],
    questions: body.questions ?? [],
  });

  return NextResponse.json({ status: "ok", template }, { status: 201 });
}
