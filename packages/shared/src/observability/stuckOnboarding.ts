import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";

// Give a freshly-created account a few days before flagging it — most
// incompleteness at hour 1 is just "Admin hasn't finished the wizard yet,"
// not a stuck account.
const STUCK_AFTER_DAYS = 3;

export interface StuckOnboardingRow {
  ownerType: "business" | "parentOrg";
  ownerId: string;
  name: string;
  createdAt: Date;
  missing: string[];
}

/**
 * Platform Health's "stuck onboarding" list — the server-side, persistent
 * twin of the one-time confirm-dialog check on Business create (see
 * admin/businesses/[id]/business-detail-client.tsx). That dialog only ever
 * catches an incomplete account at the moment of creation; this catches
 * one that's still incomplete days later, which is the actual "stuck" case.
 */
export async function findStuckOnboardingAccounts(): Promise<StuckOnboardingRow[]> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const [businesses, orgs] = await Promise.all([
    Business.find({ active: true, createdAt: { $lte: cutoff } }).select(
      "name createdAt questionTemplateId billingAssignment pricingTerms contactPhone parentOrgId"
    ),
    ParentOrganization.find({ createdAt: { $lte: cutoff } }).select("name createdAt contactPhone contactEmail"),
  ]);

  const rows: StuckOnboardingRow[] = [];

  for (const b of businesses) {
    const missing: string[] = [];
    if (!b.questionTemplateId) missing.push("No question template — feedback form has no questions");
    if (b.billingAssignment !== "group_pays" && !b.pricingTerms?.amount) missing.push("No pricing set");
    if (!b.contactPhone) missing.push("No contact phone");
    if (missing.length > 0) {
      rows.push({ ownerType: "business", ownerId: b._id.toString(), name: b.name, createdAt: b.createdAt, missing });
    }
  }

  for (const org of orgs) {
    const missing: string[] = [];
    if (!org.contactPhone) missing.push("No contact phone");
    if (!org.contactEmail) missing.push("No contact email");
    if (missing.length > 0) {
      rows.push({ ownerType: "parentOrg", ownerId: org._id.toString(), name: org.name, createdAt: org.createdAt, missing });
    }
  }

  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
