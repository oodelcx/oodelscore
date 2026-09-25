import { Types } from "mongoose";
import { Business } from "../models/Business";
import { computeBusinessMetrics } from "./aggregate";
import { meetsAnonymityFloor } from "../anonymity";

// A star average below this reads as "customers are struggling here" on the
// same 1-5 scale used everywhere else in the product.
const AT_RISK_STAR_AVERAGE = 3.5;
// eNPS is computed identically to CX's NPS (see computeENPS in
// cxpulse/compute.ts) — %promoters - %detractors, so 0 is the natural
// "more detractors than promoters" cutoff.
const AT_RISK_ENPS = 0;

export interface CxExCorrelationRow {
  businessId: string;
  name: string;
  region: string | null;
  cxStarAverage: number | null;
  cxResponseCount: number;
  // Colleague Experience's headline metric is eNPS, not a star average (see
  // spec/PDF Section on EX Pulse) — computeBusinessMetrics' npsScore is the
  // same %promoters-%detractors computation, just scoped to this business's
  // colleague_experience responses.
  ceEnps: number | null;
  ceResponseCount: number;
  // A branch's Colleague Experience numbers never render below the
  // anonymity floor (see anonymity.ts) — this view is no exception, even
  // though it's an internal dashboard, not a public one. ceEnps is already
  // null'd out when this is true; the flag lets the UI say why instead of
  // just showing a blank.
  ceBelowAnonymityFloor: boolean;
  atRiskOnBoth: boolean;
}

/**
 * "Branches ranked by both scores together, so a branch that is failing on
 * both customer and staff experience stands out immediately" — the one
 * thing neither product can show on its own, since each only ever queries
 * its own product's responses. Deliberately kept to a live 30-day-window
 * computation over computeBusinessMetrics rather than a new stored model:
 * the same per-business metrics both CX Pulse and Command Center already
 * compute the same way, just read for both products side by side.
 */
export async function computeCxExCorrelationRows(
  businessIds: (Types.ObjectId | string)[],
  from: Date,
  to: Date
): Promise<CxExCorrelationRow[]> {
  if (businessIds.length === 0) return [];
  const businesses = await Business.find({ _id: { $in: businessIds } }).select("name region");

  const rows = await Promise.all(
    businesses.map(async (b) => {
      const [cx, ce] = await Promise.all([
        computeBusinessMetrics(b._id, from, to, "customer_experience"),
        computeBusinessMetrics(b._id, from, to, "colleague_experience"),
      ]);
      const ceBelowAnonymityFloor = !meetsAnonymityFloor(ce.responseCount);
      const ceEnps = ceBelowAnonymityFloor ? null : ce.npsScore;
      const atRiskOnBoth =
        cx.starAverage !== null && cx.starAverage < AT_RISK_STAR_AVERAGE && ceEnps !== null && ceEnps < AT_RISK_ENPS;

      return {
        businessId: b._id.toString(),
        name: b.name,
        region: b.region ?? null,
        cxStarAverage: cx.starAverage,
        cxResponseCount: cx.responseCount,
        ceEnps,
        ceResponseCount: ce.responseCount,
        ceBelowAnonymityFloor,
        atRiskOnBoth,
      };
    })
  );

  // Worst-on-both first, so the branch that most needs attention is what a
  // busy exec sees without scrolling — same "surface outliers first"
  // principle the rest of the product already follows.
  return rows.sort((a, b) => {
    if (a.atRiskOnBoth !== b.atRiskOnBoth) return a.atRiskOnBoth ? -1 : 1;
    return (a.cxStarAverage ?? 5) - (b.cxStarAverage ?? 5);
  });
}
