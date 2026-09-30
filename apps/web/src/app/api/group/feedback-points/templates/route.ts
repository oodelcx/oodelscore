import { NextResponse } from "next/server";
import { connectToDatabase, QuestionTemplate, getEnabledProducts } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** The Group-side twin of /api/business/feedback-points/templates — same read-only template library, scoped to the org's own product(s). */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const products = getEnabledProducts(session.org);
  const templates = await QuestionTemplate.find({ product: { $in: products } }).sort({ name: 1 });

  return NextResponse.json({
    status: "ok",
    templates: templates.map((t) => ({
      _id: t._id,
      name: t.name,
      product: t.product,
      questions: t.questions.map((q) => ({ _id: q._id, text: q.text, type: q.type, required: q.required })),
    })),
  });
}
