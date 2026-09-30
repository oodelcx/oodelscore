import { randomBytes } from "crypto";
import type { Types } from "mongoose";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { QUESTION_TYPES, type IQuestion, type QuestionType } from "../models/QuestionTemplate";
import { getEnabledProducts } from "../models/products";
import type { Product } from "../models/products";

const CHOICE_TYPES: readonly QuestionType[] = ["multiple_choice", "multi_select", "dropdown"];

/**
 * Validates and normalizes one authored question from the survey builder's
 * request body — real authoring, not a fixed checklist: a business writes
 * its own question text and picks any of the QUESTION_TYPES, optionally
 * starting from a copy of an Admin template's question as a first draft
 * (see the builder UI), but from the moment it's submitted here it's the
 * feedback point's own question, never a link back to the template.
 */
function parseQuestion(raw: unknown): IQuestion | { error: string } {
  const q = raw as Record<string, unknown> | null;
  const text = typeof q?.text === "string" ? q.text.trim() : "";
  if (!text) return { error: "Every question needs its own text" };

  const type = typeof q?.type === "string" ? (q.type as QuestionType) : null;
  if (!type || !QUESTION_TYPES.includes(type)) return { error: `"${text}" needs a question type` };

  const options = Array.isArray(q?.options) ? (q!.options as unknown[]).filter((o): o is string => typeof o === "string" && !!o.trim()) : [];
  if (CHOICE_TYPES.includes(type) && options.length < 2) {
    return { error: `"${text}" needs at least two answer options` };
  }

  return {
    text,
    type,
    categoryId: typeof q?.categoryId === "string" && q.categoryId ? (q.categoryId as unknown as IQuestion["categoryId"]) : null,
    required: !!q?.required,
    options: CHOICE_TYPES.includes(type) ? options : [],
    isCsatQuestion: !!q?.isCsatQuestion,
  };
}

/**
 * The business-side survey builder's actual create logic (PRODUCT-ROADMAP.md
 * Phase 6), shared between the standalone-business route and the Group
 * (parent org) route — a branch under a parent org never gets this itself
 * (see each route's own comment for why), but the validation is identical
 * either way. Builds a feedback point from a fully authored `questions`
 * array (any text, any QUESTION_TYPES, options for choice types) — a
 * template, when the client-side builder started from one, only ever
 * seeded the initial draft; nothing here reads or writes a QuestionTemplate.
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

  const product: Product = typeof b?.product === "string" && ["customer_experience", "colleague_experience"].includes(b.product)
    ? (b.product as Product)
    : "customer_experience";
  if (!getEnabledProducts({ enabledProducts: params.enabledProducts }).includes(product)) {
    return { status: "error", message: "That product isn't available on this account" };
  }

  const rawQuestions = Array.isArray(b?.questions) ? b!.questions : [];
  if (rawQuestions.length === 0) return { status: "error", message: "Add at least one question" };

  const customQuestions: IQuestion[] = [];
  for (const raw of rawQuestions) {
    const parsed = parseQuestion(raw);
    if ("error" in parsed) return { status: "error", message: parsed.error };
    customQuestions.push(parsed);
  }
  // isCsatQuestion mirrors QuestionTemplate's own "at most one per set"
  // rule — enforced server-side here too, not just left to the builder UI.
  let seenCsat = false;
  for (const q of customQuestions) {
    if (q.isCsatQuestion) {
      if (seenCsat) q.isCsatQuestion = false;
      seenCsat = true;
    }
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
    product,
    name,
    description: typeof b?.description === "string" ? b.description.trim() : "",
    qrToken: randomBytes(16).toString("hex"),
    customQuestions,
    responseQuota,
  });

  return { status: "ok", feedbackPoint };
}
