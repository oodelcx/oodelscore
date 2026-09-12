import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { CxPulseScore, type CxPulseLevel } from "../models/CxPulseScore";
import type { BillingOwnerType } from "../models/BillingSubscription";

const STUCK_MONTHS = 3;

export interface PortfolioSignal {
  ownerType: BillingOwnerType;
  ownerId: string;
  name: string;
  level: CxPulseLevel;
  signal: "at_risk" | "expansion_ready";
}

/**
 * Spec Section 7: Admin's Portfolio view flags accounts stuck at Level 1-2
 * for 3+ months as "at risk" (churn signal) and Level 4-5 as "expansion
 * ready" (upsell/case-study candidates). Read-only aggregation over the
 * scheduled job's own output — never recomputes scores itself.
 */
export async function findPortfolioSignals(): Promise<PortfolioSignal[]> {
  const [businesses, parentOrgs] = await Promise.all([
    Business.find({ active: true }).select("_id name"),
    ParentOrganization.find().select("_id name"),
  ]);

  const owners: { ownerType: BillingOwnerType; ownerId: string; name: string }[] = [
    ...businesses.map((b) => ({ ownerType: "business" as const, ownerId: b._id.toString(), name: b.name })),
    ...parentOrgs.map((o) => ({ ownerType: "parentOrg" as const, ownerId: o._id.toString(), name: o.name })),
  ];

  const signals: PortfolioSignal[] = [];
  for (const owner of owners) {
    const recent = await CxPulseScore.find({ ownerType: owner.ownerType, ownerId: owner.ownerId })
      .sort({ period: -1 })
      .limit(STUCK_MONTHS);
    if (recent.length < STUCK_MONTHS) continue;

    if (recent.every((s) => s.level <= 2)) {
      signals.push({ ...owner, level: recent[0].level, signal: "at_risk" });
    } else if (recent.every((s) => s.level >= 4)) {
      signals.push({ ...owner, level: recent[0].level, signal: "expansion_ready" });
    }
  }

  return signals;
}
