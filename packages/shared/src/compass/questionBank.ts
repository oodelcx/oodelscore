import type { Product } from "../models/products";

/**
 * OodelCX Compass's fixed ANCHOR assessment question bank — see
 * PRODUCT-ROADMAP.md Phase 7 for the full spec and the product owner's
 * sign-off. Every account answers the same six dimensions on the same 0-3
 * ladder; only the industry-specific EXAMPLE text inside a question
 * changes (via {{token}} placeholders resolved by
 * ../compass/industryContent.ts), never the question's meaning or the
 * scoring — that's what keeps Compass results comparable across accounts.
 */
export const ANCHOR_DIMENSIONS = ["authority", "numbers", "culture", "hearing", "ownership", "rhythm"] as const;
export type AnchorDimension = (typeof ANCHOR_DIMENSIONS)[number];

export const ANCHOR_DIMENSION_LABELS: Record<AnchorDimension, string> = {
  authority: "Authority",
  numbers: "Numbers",
  culture: "Culture",
  hearing: "Hearing",
  ownership: "Ownership",
  rhythm: "Rhythm",
};

// "shared" = asked once regardless of product. "cx"/"ex" = only asked when
// the account has that product enabled (see questionsForProducts below).
export type CompassQuestionVariant = "shared" | "cx" | "ex";

export interface CompassQuestionDef {
  key: string;
  dimension: AnchorDimension;
  variant: CompassQuestionVariant;
  // May contain {{numbersOutcomeExamples}}, {{hearingChannelExamples}},
  // {{ownershipRoleExamples}}, or {{rhythmTriggerExample}} tokens —
  // resolved per-account by compass/industryContent.ts's renderQuestionText().
  text: string;
}

export const COMPASS_QUESTION_BANK: readonly CompassQuestionDef[] = [
  // Authority — asked once
  { key: "authority_1", dimension: "authority", variant: "shared", text: "Does a named senior leader own experience management as part of their actual role?" },
  { key: "authority_2", dimension: "authority", variant: "shared", text: "Is experience performance reviewed at leadership level, on a regular schedule?" },
  { key: "authority_3", dimension: "authority", variant: "shared", text: "Are there formal objectives tied to experience outcomes?" },

  // Numbers (Net-worth) — asked once
  {
    key: "numbers_1",
    dimension: "numbers",
    variant: "shared",
    text: "Can you currently point to a specific business outcome that improved because of an experience change{{numbersOutcomeExamples}}?",
  },
  { key: "numbers_2", dimension: "numbers", variant: "shared", text: "Is spend on experience management justified with numbers, or mostly on instinct?" },

  // Culture — asked once
  { key: "culture_1", dimension: "culture", variant: "shared", text: "Do frontline staff regularly see the feedback customers/colleagues give about their own area?" },
  { key: "culture_2", dimension: "culture", variant: "shared", text: "Are managers held accountable for experience outcomes in their performance reviews?" },

  // Hearing — CX version
  {
    key: "hearing_cx_1",
    dimension: "hearing",
    variant: "cx",
    text: "How do you currently collect customer feedback{{hearingChannelExamples}} — one method, or several combined?",
  },
  { key: "hearing_cx_2", dimension: "hearing", variant: "cx", text: "How often is that feedback actually reviewed by someone, not just collected?" },

  // Hearing — EX version
  { key: "hearing_ex_1", dimension: "hearing", variant: "ex", text: "How do you currently check in on colleague sentiment — one-off, or on a regular cadence?" },
  { key: "hearing_ex_2", dimension: "hearing", variant: "ex", text: "Are different roles/teams measured separately, or only the organization as a whole?" },

  // Ownership — CX version
  {
    key: "ownership_cx_1",
    dimension: "ownership",
    variant: "cx",
    text: "When a customer reports a problem, is it assigned to a specific person{{ownershipRoleExamples}}, or handled informally?",
  },
  { key: "ownership_cx_2", dimension: "ownership", variant: "cx", text: "Are unresolved customer issues tracked to a close, or do they just fade out?" },

  // Ownership — EX version
  { key: "ownership_ex_1", dimension: "ownership", variant: "ex", text: "When a colleague raises a concern (even anonymously, in aggregate), does anything visibly happen as a result?" },
  { key: "ownership_ex_2", dimension: "ownership", variant: "ex", text: "Is there a defined path for an EX concern to reach the right manager without breaking anonymity?" },

  // Rhythm — asked once
  {
    key: "rhythm_1",
    dimension: "rhythm",
    variant: "shared",
    text: "When the same problem comes up repeatedly{{rhythmTriggerExample}}, does it typically trigger a structural change (new training, new process), or does each instance just get handled individually?",
  },
] as const;

/**
 * Which questions an account actually answers, based on which product(s)
 * it has enabled — a shared question is always included; a cx/ex question
 * only when that product is on. Order follows ANCHOR_DIMENSIONS so the
 * assessment-taking flow (Phase 7b) can render dimension-by-dimension.
 */
export function questionsForProducts(products: readonly Product[]): CompassQuestionDef[] {
  const hasCx = products.includes("customer_experience");
  const hasEx = products.includes("colleague_experience");
  return COMPASS_QUESTION_BANK.filter((q) => q.variant === "shared" || (q.variant === "cx" && hasCx) || (q.variant === "ex" && hasEx));
}
