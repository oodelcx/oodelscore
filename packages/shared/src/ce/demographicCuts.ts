import { Types } from "mongoose";
import { Response } from "../models/Response";
import { meetsAnonymityFloor } from "../anonymity";

const DEMOGRAPHIC_FIELDS = ["ageGroup", "gender"] as const;
type DemographicField = (typeof DEMOGRAPHIC_FIELDS)[number];

export interface DemographicCut {
  value: string;
  responseCount: number;
  // null whenever responseCount is below the anonymity floor — the cut
  // exists (so the UI can show "not enough responses yet") but the actual
  // number is never computed or returned, per anonymity.ts's own rule: a
  // suppressed slice shows genuinely nothing, not a blurred figure.
  enps: number | null;
}

export interface DemographicBreakdown {
  ageGroup: DemographicCut[];
  gender: DemographicCut[];
}

/**
 * eNPS cut by self-reported demographic (age group, gender) — Colleague
 * Experience only, with the same MIN_ANONYMITY_GROUP_SIZE floor applied to
 * every cut, not just the overall score. A cut below the floor is still
 * listed (so a business can see "not enough responses in this group yet"
 * rather than the group silently not existing) but its eNPS is withheld.
 *
 * Only ageGroup and gender exist on Response.demographics today (see
 * Response.ts) — tenure band and department from the original CE roadmap
 * aren't collected yet, so this covers what's actually there.
 */
export async function computeColleagueDemographicBreakdown(
  businessIds: (Types.ObjectId | string)[],
  from: Date,
  to: Date
): Promise<DemographicBreakdown> {
  const responses = await Response.find({
    businessId: { $in: businessIds },
    product: "colleague_experience",
    submittedAt: { $gte: from, $lte: to },
  })
    .select("answers demographics")
    .lean();

  function breakdownFor(field: DemographicField): DemographicCut[] {
    const scoresByValue = new Map<string, number[]>();
    const countByValue = new Map<string, number>();

    for (const response of responses) {
      const value = response.demographics?.[field];
      if (!value) continue; // not answered — excluded rather than bucketed as "unknown"
      countByValue.set(value, (countByValue.get(value) ?? 0) + 1);
      const scores = scoresByValue.get(value) ?? [];
      for (const answer of response.answers) {
        if (answer.type === "nps_0_10" && typeof answer.value === "number") scores.push(answer.value);
      }
      scoresByValue.set(value, scores);
    }

    const cuts: DemographicCut[] = [];
    for (const [value, responseCount] of countByValue.entries()) {
      if (!meetsAnonymityFloor(responseCount)) {
        cuts.push({ value, responseCount, enps: null });
        continue;
      }
      const scores = scoresByValue.get(value) ?? [];
      if (scores.length === 0) {
        cuts.push({ value, responseCount, enps: null });
        continue;
      }
      const promoters = scores.filter((s) => s >= 9).length;
      const detractors = scores.filter((s) => s <= 6).length;
      cuts.push({ value, responseCount, enps: Math.round(((promoters - detractors) / scores.length) * 100) });
    }

    return cuts.sort((a, b) => b.responseCount - a.responseCount);
  }

  return {
    ageGroup: breakdownFor("ageGroup"),
    gender: breakdownFor("gender"),
  };
}
