import type { Product } from "../models/products";
import { CompassQuestion } from "../models/CompassQuestion";
import { ANCHOR_DIMENSIONS, ANCHOR_DIMENSION_LABELS, COMPASS_QUESTION_VARIANTS, type AnchorDimension, type CompassQuestionVariant } from "./constants";

/**
 * OodelCX Compass's ANCHOR assessment question bank — see
 * PRODUCT-ROADMAP.md Phase 7 for the full spec and the product owner's
 * sign-off. Every account answers the same six dimensions on the same 0-3
 * ladder — that's what keeps Compass results comparable across accounts.
 * The six dimensions and the gate-based scoring are fixed (see
 * ./constants.ts); the actual question text is admin-editable (see
 * ../models/CompassQuestion.ts and the Admin -> Compass Questions screen)
 * rather than hardcoded here.
 */
export { ANCHOR_DIMENSIONS, ANCHOR_DIMENSION_LABELS, COMPASS_QUESTION_VARIANTS, type AnchorDimension, type CompassQuestionVariant };

export interface CompassQuestionDef {
  key: string;
  dimension: AnchorDimension;
  variant: CompassQuestionVariant;
  text: string;
}

const DIMENSION_ORDER = new Map(ANCHOR_DIMENSIONS.map((d, i) => [d, i]));

/** The full admin-editable question bank, in ANCHOR_DIMENSIONS order then by each question's `order` field. */
export async function getCompassQuestionBank(): Promise<CompassQuestionDef[]> {
  const docs = await CompassQuestion.find().lean();
  return docs
    .map((d) => ({ key: d.key, dimension: d.dimension, variant: d.variant, text: d.text, order: d.order }))
    .sort((a, b) => {
      const dimDiff = (DIMENSION_ORDER.get(a.dimension) ?? 0) - (DIMENSION_ORDER.get(b.dimension) ?? 0);
      return dimDiff !== 0 ? dimDiff : a.order - b.order;
    });
}

/**
 * Which questions an account actually answers, based on which product(s)
 * it has enabled — a shared question is always included; a cx/ex question
 * only when that product is on. Order follows ANCHOR_DIMENSIONS so the
 * assessment-taking flow renders dimension-by-dimension.
 */
export async function questionsForProducts(products: readonly Product[]): Promise<CompassQuestionDef[]> {
  const hasCx = products.includes("customer_experience");
  const hasEx = products.includes("colleague_experience");
  const bank = await getCompassQuestionBank();
  return bank.filter((q) => q.variant === "shared" || (q.variant === "cx" && hasCx) || (q.variant === "ex" && hasEx));
}
