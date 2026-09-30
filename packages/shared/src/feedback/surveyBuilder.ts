import { randomBytes } from "crypto";
import type { Types } from "mongoose";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { QuestionTemplate } from "../models/QuestionTemplate";
import { getEnabledProducts } from "../models/products";
import type { Product } from "../models/products";

/**
 * The business-side survey builder's actual create logic (PRODUCT-ROADMAP.md
 * Phase 6), shared between the standalone-business route and the Group
 * (parent org) route — a branch under a parent org never gets this itself
 * (see each route's own comment for why), but the validation is identical
 * either way: compose from an Admin-authored QuestionTemplate's own
 * already-existing questions, never write new question text/categories.
 */
export async function buildFeedbackPointFromTemplate(params: {
  businessId: Types.ObjectId;
  enabledProducts: Product[] | null;
  maxFeedbackPoints: number;
  body: unknown;
}): Promise<{ status: "error"; message: string } | { status: "ok"; feedbackPoint: InstanceType<typeof FeedbackPoint> }> {
  const { businessId, body } = params;

  const existingCount = await FeedbackPoint.countDocuments({ businessId });
  if (existingCount >= params.maxFeedbackPoints) {
    return { status: "error", message: `This plan allows up to ${params.maxFeedbackPoints} feedback point(s). Contact your account manager to add more.` };
  }

  const b = body as Record<string, unknown> | null;
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  if (!name) return { status: "error", message: "Name is required" };

  const templateId = typeof b?.templateId === "string" ? b.templateId : "";
  if (!templateId) return { status: "error", message: "Pick a survey template to build from" };

  const template = await QuestionTemplate.findById(templateId);
  if (!template || !getEnabledProducts({ enabledProducts: params.enabledProducts }).includes(template.product)) {
    return { status: "error", message: "That template isn't available on this account" };
  }

  const templateQuestionIds = new Set(template.questions.map((q) => q._id?.toString()).filter((x): x is string => !!x));
  const requestedIds: string[] = Array.isArray(b?.selectedQuestionIds)
    ? (b!.selectedQuestionIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  const selectedQuestionIds = requestedIds.filter((id) => templateQuestionIds.has(id));
  if (selectedQuestionIds.length === 0) {
    return { status: "error", message: "Pick at least one question from the template" };
  }

  let responseQuota: number | null = null;
  if (b?.responseQuota !== undefined && b?.responseQuota !== null && b?.responseQuota !== "") {
    const quota = Number(b.responseQuota);
    if (!Number.isFinite(quota) || quota < 1) {
      return { status: "error", message: "Response quota must be a positive number" };
    }
    responseQuota = Math.floor(quota);
  }

  const feedbackPoint = await FeedbackPoint.create({
    businessId,
    product: template.product,
    name,
    description: typeof b?.description === "string" ? b.description.trim() : "",
    qrToken: randomBytes(16).toString("hex"),
    questionTemplateOverride: template._id,
    selectedQuestionIds,
    responseQuota,
  });

  return { status: "ok", feedbackPoint };
}
