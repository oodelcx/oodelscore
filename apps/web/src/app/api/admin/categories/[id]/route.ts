import { NextResponse } from "next/server";
import { connectToDatabase, Category, QuestionTemplate } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

async function usageStats(categoryId: string) {
  const templates = await QuestionTemplate.find({ "questions.categoryId": categoryId });
  const questionCount = templates.reduce(
    (sum, t) => sum + t.questions.filter((q) => q.categoryId?.toString() === categoryId).length,
    0
  );
  return { questionCount, templateCount: templates.length };
}

/**
 * Deleting is never a blind "are you sure?" — mirrors the mockup's rule
 * ("used in N questions across M templates"). Without ?force=true, a
 * category in use is refused with the usage counts; pass force=true (after
 * showing those counts to the user) to delete anyway. Existing question
 * rows keep their now-dangling categoryId — this doesn't cascade-edit
 * templates, matching the mockup's scope.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.delete) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const force = new URL(request.url).searchParams.get("force") === "true";

  await connectToDatabase();
  const category = await Category.findById(id);
  if (!category) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const usage = await usageStats(id);
  if (usage.questionCount > 0 && !force) {
    return NextResponse.json(
      {
        status: "error",
        message: `Used in ${usage.questionCount} question(s) across ${usage.templateCount} template(s). Pass force=true to delete anyway.`,
        usage,
      },
      { status: 409 }
    );
  }

  await category.deleteOne();
  return NextResponse.json({ status: "ok" });
}
