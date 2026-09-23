import { NextResponse } from "next/server";
import { connectToDatabase, Business, QuestionTemplate, FeedbackPoint, hasFeature, NUMERIC_QUESTION_TYPES } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * The union of numeric (chartable) questions asked across every branch's
 * feedback points under this org, for the Analytics page's per-question
 * trend selector.
 */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "analytics" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "analytics")) {
    return NextResponse.json({ status: "error", message: "Analytics is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id questionTemplateId");
  const businessIds = businesses.map((b) => b._id);
  const overrideIds = await FeedbackPoint.find({ businessId: { $in: businessIds }, questionTemplateOverride: { $ne: null } }).distinct(
    "questionTemplateOverride"
  );
  const templateIds = [...businesses.map((b) => b.questionTemplateId), ...overrideIds].filter((id): id is NonNullable<typeof id> => !!id);
  const templates = await QuestionTemplate.find({ _id: { $in: templateIds } });

  const questions: { _id: string; text: string; type: string; categoryId: string | null }[] = [];
  const seen = new Set<string>();
  for (const template of templates) {
    for (const q of template.questions) {
      if (!q._id || !NUMERIC_QUESTION_TYPES.includes(q.type)) continue;
      const key = q._id.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push({ _id: key, text: q.text, type: q.type, categoryId: q.categoryId?.toString() ?? null });
    }
  }

  return NextResponse.json({ status: "ok", questions });
}
