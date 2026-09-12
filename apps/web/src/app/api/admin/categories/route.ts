import { NextResponse } from "next/server";
import { connectToDatabase, Category, QuestionTemplate } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const [categories, templates] = await Promise.all([Category.find().sort({ name: 1 }), QuestionTemplate.find()]);

  const usageByCategory = new Map<string, { questionCount: number; templateIds: Set<string> }>();
  for (const template of templates) {
    for (const question of template.questions) {
      if (!question.categoryId) continue;
      const key = question.categoryId.toString();
      const entry = usageByCategory.get(key) ?? { questionCount: 0, templateIds: new Set<string>() };
      entry.questionCount += 1;
      entry.templateIds.add(template._id.toString());
      usageByCategory.set(key, entry);
    }
  }

  const enriched = categories.map((c) => {
    const usage = usageByCategory.get(c._id.toString());
    return {
      ...c.toObject(),
      questionCount: usage?.questionCount ?? 0,
      templateCount: usage?.templateIds.size ?? 0,
    };
  });

  return NextResponse.json({ status: "ok", categories: enriched });
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

  await connectToDatabase();
  const existing = await Category.findOne({ name: body.name.trim() });
  if (existing) {
    return NextResponse.json({ status: "error", message: "A category with this name already exists" }, { status: 409 });
  }

  const category = await Category.create({ name: body.name.trim() });
  return NextResponse.json({ status: "ok", category }, { status: 201 });
}
