import type { Types } from "mongoose";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { Business } from "../models/Business";
import { QuestionTemplate } from "../models/QuestionTemplate";

/**
 * Resolves each answer's question TEXT for a set of responses, the same
 * template-lookup chain Analytics' "questions" endpoint already uses (a
 * feedback point's own questionTemplateOverride, else its business's
 * questionTemplateId) — so a case detail view showing "star_1_5: 2" can
 * instead show the actual question that was asked. There's no per-response
 * snapshot of the template, so this reflects whichever template currently
 * covers that answer's questionId; if a business has since rewritten its
 * template, a very old response's wording may drift — the same limitation
 * every other question-text lookup in this app already has.
 */
async function resolveTemplateIdsForFeedbackPoints(feedbackPointIds: string[]): Promise<string[]> {
  if (feedbackPointIds.length === 0) return [];

  const points = await FeedbackPoint.find({ _id: { $in: feedbackPointIds } }).select("businessId questionTemplateOverride");
  const businessIds = [...new Set(points.map((p) => p.businessId.toString()))];
  const businesses = await Business.find({ _id: { $in: businessIds } }).select("questionTemplateId");
  const templateIdByBusinessId = new Map(businesses.map((b) => [b._id.toString(), b.questionTemplateId?.toString() ?? null]));

  const templateIds = new Set<string>();
  for (const p of points) {
    const templateId = p.questionTemplateOverride?.toString() ?? templateIdByBusinessId.get(p.businessId.toString());
    if (templateId) templateIds.add(templateId);
  }
  return [...templateIds];
}

export async function resolveQuestionTextByQuestionId(
  responses: { feedbackPointId: Types.ObjectId | null; answers: { questionId: Types.ObjectId }[] }[]
): Promise<Record<string, string>> {
  const feedbackPointIds = [...new Set(responses.map((r) => r.feedbackPointId?.toString()).filter((x): x is string => !!x))];
  const templateIds = await resolveTemplateIdsForFeedbackPoints(feedbackPointIds);
  if (templateIds.length === 0) return {};

  const templates = await QuestionTemplate.find({ _id: { $in: templateIds } });
  const textById: Record<string, string> = {};
  for (const template of templates) {
    for (const q of template.questions) {
      if (q._id) textById[q._id.toString()] = q.text;
    }
  }
  return textById;
}

/**
 * The set of questionIds marked as "the" CSAT question across whichever
 * template(s) cover this set of responses — the fix for CSAT previously
 * being computed by blending every star_1_5 answer together (the same
 * shape of bug as the original NPS/star-blending issue, one level down).
 * A response's questionId only counts toward csatPercent when it's in this
 * set; an empty set means no template involved has a CSAT question marked
 * yet, and callers should report csatPercent as null rather than 0%.
 */
export async function resolveCsatQuestionIds(
  responses: { feedbackPointId: Types.ObjectId | null }[]
): Promise<Set<string>> {
  const feedbackPointIds = [...new Set(responses.map((r) => r.feedbackPointId?.toString()).filter((x): x is string => !!x))];
  const templateIds = await resolveTemplateIdsForFeedbackPoints(feedbackPointIds);
  if (templateIds.length === 0) return new Set();

  const templates = await QuestionTemplate.find({ _id: { $in: templateIds } });
  const csatIds = new Set<string>();
  for (const template of templates) {
    for (const q of template.questions) {
      if (q.isCsatQuestion && q._id) csatIds.add(q._id.toString());
    }
  }
  return csatIds;
}
