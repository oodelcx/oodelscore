import { NextResponse } from "next/server";
import { connectToDatabase, QuestionTemplate, getEnabledProducts } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * The Admin-authored template library a business can build a survey from
 * (PRODUCT-ROADMAP.md Phase 6) — read-only, scoped to the business's own
 * product(s) plus whichever template it's currently assigned. A business
 * never sees a Colleague Experience template unless it actually has that
 * product, same gating `hasProduct` enforces everywhere else. Question
 * text/categories/options are exposed so the builder can render them, but
 * this route never accepts a write — editing a template stays Admin-only.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const products = getEnabledProducts(session.business);
  const templates = await QuestionTemplate.find({ product: { $in: products } }).sort({ name: 1 });

  return NextResponse.json({
    status: "ok",
    templates: templates.map((t) => ({
      _id: t._id,
      name: t.name,
      product: t.product,
      questions: t.questions.map((q) => ({
        _id: q._id,
        text: q.text,
        type: q.type,
        required: q.required,
        options: q.options,
        categoryId: q.categoryId,
      })),
    })),
  });
}
