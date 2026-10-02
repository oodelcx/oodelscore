/**
 * Pure constants for OodelCX Compass's ANCHOR framework — split out from
 * questionBank.ts so the CompassQuestion model (which needs these for its
 * schema enums) doesn't import a module that itself imports the model,
 * which created a circular require and broke under Next.js's bundler
 * (`Cannot access 'X' before initialization`). Everything here has zero
 * dependencies on any Mongoose model.
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
// the account has that product enabled.
export const COMPASS_QUESTION_VARIANTS = ["shared", "cx", "ex"] as const;
export type CompassQuestionVariant = (typeof COMPASS_QUESTION_VARIANTS)[number];
