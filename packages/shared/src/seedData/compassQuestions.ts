import type { ICompassQuestion } from "../models/CompassQuestion";

/**
 * Default ANCHOR question bank, seeded once per key via seedCompassQuestions()
 * — same idempotent $setOnInsert-by-key pattern as every other platform
 * default (see seedPlatformDefaults()). An admin who edits or deletes a
 * seeded question afterward is never overwritten on a later boot; this only
 * fills in a key that doesn't exist yet.
 *
 * Wording carries the same neutral examples the old IndustryContentPack
 * system interpolated by default (never industry-specific — now that
 * questions are directly admin-editable, there is no separate per-industry
 * wording layer to maintain).
 */
export const DEFAULT_COMPASS_QUESTIONS: Array<Pick<ICompassQuestion, "key" | "dimension" | "variant" | "text" | "order">> = [
  // Authority — asked once
  { key: "authority_1", dimension: "authority", variant: "shared", order: 0, text: "Does a named senior leader own experience management as part of their actual role?" },
  { key: "authority_2", dimension: "authority", variant: "shared", order: 1, text: "Is experience performance reviewed at leadership level, on a regular schedule?" },
  { key: "authority_3", dimension: "authority", variant: "shared", order: 2, text: "Are there formal objectives tied to experience outcomes?" },

  // Numbers (Net-worth) — asked once
  {
    key: "numbers_1",
    dimension: "numbers",
    variant: "shared",
    order: 0,
    text: "Can you currently point to a specific business outcome that improved because of an experience change (e.g. reduced churn, fewer complaints, higher repeat engagement)?",
  },
  { key: "numbers_2", dimension: "numbers", variant: "shared", order: 1, text: "Is spend on experience management justified with numbers, or mostly on instinct?" },

  // Culture — asked once
  { key: "culture_1", dimension: "culture", variant: "shared", order: 0, text: "Do frontline staff regularly see the feedback customers/colleagues give about their own area?" },
  { key: "culture_2", dimension: "culture", variant: "shared", order: 1, text: "Are managers held accountable for experience outcomes in their performance reviews?" },

  // Hearing — CX version
  {
    key: "hearing_cx_1",
    dimension: "hearing",
    variant: "cx",
    order: 0,
    text: "How do you currently collect customer feedback (e.g. in-person surveys, an app, email, a QR code) — one method, or several combined?",
  },
  { key: "hearing_cx_2", dimension: "hearing", variant: "cx", order: 1, text: "How often is that feedback actually reviewed by someone, not just collected?" },

  // Hearing — EX version
  { key: "hearing_ex_1", dimension: "hearing", variant: "ex", order: 0, text: "How do you currently check in on colleague sentiment — one-off, or on a regular cadence?" },
  { key: "hearing_ex_2", dimension: "hearing", variant: "ex", order: 1, text: "Are different roles/teams measured separately, or only the organization as a whole?" },

  // Ownership — CX version
  {
    key: "ownership_cx_1",
    dimension: "ownership",
    variant: "cx",
    order: 0,
    text: "When a customer reports a problem, is it assigned to a specific person (e.g. a named manager or team), or handled informally?",
  },
  { key: "ownership_cx_2", dimension: "ownership", variant: "cx", order: 1, text: "Are unresolved customer issues tracked to a close, or do they just fade out?" },

  // Ownership — EX version
  { key: "ownership_ex_1", dimension: "ownership", variant: "ex", order: 0, text: "When a colleague raises a concern (even anonymously, in aggregate), does anything visibly happen as a result?" },
  { key: "ownership_ex_2", dimension: "ownership", variant: "ex", order: 1, text: "Is there a defined path for an EX concern to reach the right manager without breaking anonymity?" },

  // Rhythm — asked once
  {
    key: "rhythm_1",
    dimension: "rhythm",
    variant: "shared",
    order: 0,
    text: "When the same problem comes up repeatedly, does it typically trigger a structural change (new training, new process), or does each instance just get handled individually?",
  },
];
