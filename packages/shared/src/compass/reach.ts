import { ANCHOR_DIMENSIONS, ANCHOR_DIMENSION_LABELS, type AnchorDimension } from "./constants";
import type { LadderValue } from "./scoring";
import type { EvidenceStatus } from "./evidenceFusion";

/**
 * REACH recommendation cards. Compass and Evidence Fusion say where an
 * account is weak; REACH says what to do about it, in five parts:
 *   Recognize - name the gap in plain words
 *   Elevate   - make it visible to whoever owns it (email, sent from the card)
 *   Align     - tie it to a goal (suggested wording; goals live on Insights)
 *   Connect   - deep link to the screen that closes the gap
 *   Habituate - turn the fix into a routine
 * A card appears for a dimension only when it is below "Embedded" or its
 * self-score is overstated; a dimension that is Embedded and confirmed
 * (or Embedded with not enough data) shows no card.
 */

export type ReachPortal = "business" | "group";

export interface ReachCard {
  dimension: AnchorDimension;
  label: string;
  selfScore: LadderValue;
  evidenceStatus: EvidenceStatus | null;
  priority: "high" | "medium" | "low";
  recognize: string;
  elevate: string;
  align: string;
  connect: { label: string; href: string };
  habituate: string;
}

interface DimensionContent {
  gap: string;
  overstated: string;
  elevate: string;
  align: string;
  connectLabel: string;
  connectPath: string;
  habituate: string;
}

/** Defaults. Every `gap`, `overstated`, `align` and `habituate` text can be overridden in Admin -> Tooltips ("Compass recommendations"). */
export const REACH_DEFAULTS: Record<AnchorDimension, DimensionContent> = {
  authority: {
    gap: "No one with authority is visibly backing feedback work yet, so fixes depend on goodwill.",
    overstated: "You rated Authority higher than the activity shows: no active goal or owned decision backs it up.",
    elevate: "Ask the person who sponsors customer or staff experience to review this.",
    align: "Set a goal leadership will review, for example “Close every case within 7 days”.",
    connectLabel: "Set a goal on Insights",
    connectPath: "/insights",
    habituate: "Review the goal in your monthly leadership meeting.",
  },
  numbers: {
    gap: "Results are not yet tied to figures the business cares about.",
    overstated: "You rated Numbers higher than the activity shows: no decision has a measured outcome and no business figures are entered.",
    elevate: "Ask finance or operations to confirm the figures used for Business Value.",
    align: "Set a goal on a measurable score, for example “Raise average rating from 4.0 to 4.3 by year end”.",
    connectLabel: "Enter business figures",
    connectPath: "/business-value",
    habituate: "Let the Decision Log measure each change automatically and read the result monthly.",
  },
  culture: {
    gap: "Feedback is collected, but good work and follow-through are not visible to the team.",
    overstated: "You rated Culture higher than the activity shows: few cases are resolved with a note and no positive feedback is being shared.",
    elevate: "Ask a team lead to share this month's strongest feedback with the team.",
    align: "Set a goal for resolved cases, for example “No overdue cases at month end”.",
    connectLabel: "Open Highlights",
    connectPath: "/highlights",
    habituate: "Share one Highlight with the team every week.",
  },
  hearing: {
    gap: "Not enough channels or enough people are giving feedback to hear the full picture.",
    overstated: "You rated Hearing higher than the activity shows: too few recent responses or feedback points are live.",
    elevate: "Ask the location manager to put the QR code where customers actually wait.",
    align: "Set a goal for coverage, for example “50 responses per location per month”.",
    connectLabel: "Open Feedback Points",
    connectPath: "/feedback-points",
    habituate: "Check the monthly response count for each feedback point and move any that are quiet.",
  },
  ownership: {
    gap: "Issues do not have a clear owner, so they wait.",
    overstated: "You rated Ownership higher than the activity shows: categories have no owner, or cases sit unassigned.",
    elevate: "Ask each department head to take the categories that belong to them.",
    align: "Set a goal for ownership, for example “Every case assigned within 1 day”.",
    connectLabel: "Set Category Owners",
    connectPath: "/category-owners",
    habituate: "Review unassigned and overdue cases every Monday.",
  },
  rhythm: {
    gap: "There is no regular routine for reviewing feedback and acting on it.",
    overstated: "You rated Rhythm higher than the activity shows: no routine such as a playbook or a regular review is in place.",
    elevate: "Ask the case owner to book a standing weekly review.",
    align: "Set a goal for follow-through, for example “Resolve 90% of cases inside the agreed time”.",
    connectLabel: "Open Playbooks",
    connectPath: "/playbooks",
    habituate: "Attach a Playbook to the category that comes up most often and retake Compass when it is due.",
  },
};

export type ReachOverrides = Record<string, string> | undefined;

export function reachOverrideKey(dimension: AnchorDimension, part: "gap" | "overstated" | "align" | "habituate" | "elevate"): string {
  return `${dimension}-${part}`;
}

export function buildReachCards(input: {
  dimensionScores: { dimension: AnchorDimension; score: LadderValue }[];
  evidence: { dimension: AnchorDimension; status: EvidenceStatus }[] | null;
  portal: ReachPortal;
  overrides?: ReachOverrides;
}): ReachCard[] {
  const pick = (dimension: AnchorDimension, part: "gap" | "overstated" | "align" | "habituate" | "elevate") =>
    input.overrides?.[reachOverrideKey(dimension, part)]?.trim() || REACH_DEFAULTS[dimension][part];

  const evidenceBy = new Map((input.evidence ?? []).map((e) => [e.dimension, e.status]));
  const cards: ReachCard[] = [];
  for (const dimension of ANCHOR_DIMENSIONS) {
    const score = input.dimensionScores.find((d) => d.dimension === dimension)?.score;
    if (score === undefined) continue;
    const status = evidenceBy.get(dimension) ?? null;
    const overstated = status === "overstated";
    if (score >= 3 && !overstated) continue;
    const c = REACH_DEFAULTS[dimension];
    cards.push({
      dimension,
      label: ANCHOR_DIMENSION_LABELS[dimension],
      selfScore: score,
      evidenceStatus: status,
      priority: score <= 1 || overstated ? "high" : "medium",
      recognize: overstated ? pick(dimension, "overstated") : pick(dimension, "gap"),
      elevate: pick(dimension, "elevate"),
      align: pick(dimension, "align"),
      connect: { label: c.connectLabel, href: `/${input.portal}${c.connectPath}` },
      habituate: pick(dimension, "habituate"),
    });
  }
  const order = { high: 0, medium: 1, low: 2 } as const;
  return cards.sort((a, b) => order[a.priority] - order[b.priority] || a.selfScore - b.selfScore);
}
