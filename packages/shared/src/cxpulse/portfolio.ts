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
  // Spec Section 16.5: branch-seat usage is the actual expansion-ready
  // signal for account managers, shown paired with the level rather than
  // requiring a separate page. parentOrg owners only.
  branchSeatLimit?: number | null;
  activeBranchCount?: number;
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
    ParentOrganization.find().select("_id name branchSeatLimit"),
  ]);

  const activeBranchCounts = new Map<string, number>();
  for (const org of parentOrgs) {
    activeBranchCounts.set(org._id.toString(), await Business.countDocuments({ parentOrgId: org._id, active: true }));
  }

  const owners: { ownerType: BillingOwnerType; ownerId: string; name: string; branchSeatLimit?: number | null; activeBranchCount?: number }[] = [
    ...businesses.map((b) => ({ ownerType: "business" as const, ownerId: b._id.toString(), name: b.name })),
    ...parentOrgs.map((o) => ({
      ownerType: "parentOrg" as const,
      ownerId: o._id.toString(),
      name: o.name,
      branchSeatLimit: o.branchSeatLimit,
      activeBranchCount: activeBranchCounts.get(o._id.toString()) ?? 0,
    })),
  ];

  const signals: PortfolioSignal[] = [];
  for (const owner of owners) {
    // Explicitly customer_experience: CxPulseScore now also carries
    // colleague_experience rows (see cxpulse/compute.ts), which must never
    // mix into this CX-specific stuck/ready signal.
    const recent = await CxPulseScore.find({ ownerType: owner.ownerType, ownerId: owner.ownerId, product: "customer_experience" })
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
