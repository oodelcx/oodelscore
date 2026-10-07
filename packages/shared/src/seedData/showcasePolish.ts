import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { User } from "../models/User";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { CaseEventLogEntry } from "../models/CaseEventLogEntry";
import { EscalationAssignment } from "../models/EscalationAssignment";
import { CxGoal } from "../models/CxGoal";
import { DecisionLogEntry } from "../models/DecisionLogEntry";
import { Playbook } from "../models/Playbook";
import { hasProduct } from "../models/products";

/**
 * Fills the gaps that made the showcase feel unfinished: screens that said
 * "No one assigned yet", "No changes recorded yet", "No goals set yet", "Not yet"
 * (business value) or "No playbooks yet". Every row uses the same models and fields
 * the product writes itself. Idempotent: each block only fills what is missing, and
 * it never touches anything a person has already set up.
 */
export interface ShowcasePolishResult {
  escalationAssignments: number;
  businessValueInputs: number;
  caseEvents: number;
  colleagueGoals: number;
  colleagueDecisions: number;
  playbooks: number;
}

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

export async function seedShowcasePolish(): Promise<ShowcasePolishResult> {
  const result: ShowcasePolishResult = { escalationAssignments: 0, businessValueInputs: 0, caseEvents: 0, colleagueGoals: 0, colleagueDecisions: 0, playbooks: 0 };

  // 1. Escalation: someone really holds each level above 1 (level 1 is always the branch owner).
  for (const org of await ParentOrganization.find({})) {
    if (await EscalationAssignment.exists({ parentOrgId: org._id })) continue;
    const team = await User.find({ accountType: "team_member", parentId: org._id }).sort({ email: 1 });
    const owner = await User.findOne({ accountType: "parent_org", parentId: org._id });
    const levels = (org.escalationLevels ?? []).map((l) => l.level).filter((n) => n > 1);
    for (const level of levels) {
      const user = level === levels[levels.length - 1] ? owner ?? team[0] : team[(level - 2) % Math.max(team.length, 1)] ?? owner;
      if (!user) continue;
      await EscalationAssignment.create({ parentOrgId: org._id, businessId: null, region: "", level, userId: user._id });
      result.escalationAssignments++;
    }
  }

  // 2. Business Value inputs for every customer-product business (the page shows "Not yet" without them).
  const customerBusinesses = await Business.find({});
  for (const b of customerBusinesses) {
    if (!hasProduct(b, "customer_experience")) continue;
    const v = b.businessValueInputs;
    if (v && v.avgTransactionValue !== null && v.avgTransactionValue !== undefined) continue;
    b.businessValueInputs = { avgTransactionValue: 38, visitsPerYear: 9, acquisitionCost: 85, atRiskStarThreshold: 2, currencySymbol: "$" };
    await b.save();
    result.businessValueInputs++;
  }

  // 3. A believable case trail for every case that has none: opened, picked up, resolved.
  const cases = await ActionBoardItem.find({});
  const withTrail = new Set((await CaseEventLogEntry.distinct("actionBoardItemId")).map((id) => String(id)));
  for (const item of cases) {
    if (withTrail.has(String(item._id))) continue;
    const created = item.createdAt ?? daysAgo(10);
    const rows: { kind: "status_changed" | "owner_changed"; fromValue: string | null; toValue: string | null; createdAt: Date }[] = [];
    if (item.ownerId) {
      const owner = await User.findById(item.ownerId).select("email");
      rows.push({ kind: "owner_changed", fromValue: null, toValue: owner?.email ?? "assigned owner", createdAt: new Date(created.getTime() + 5 * 60 * 1000) });
    }
    if (item.status !== "open") rows.push({ kind: "status_changed", fromValue: "open", toValue: "in_progress", createdAt: new Date(created.getTime() + 2 * 60 * 60 * 1000) });
    if (item.status === "resolved") rows.push({ kind: "status_changed", fromValue: "in_progress", toValue: "resolved", createdAt: item.resolvedAt ?? new Date(created.getTime() + 3 * DAY) });
    for (const r of rows) {
      await CaseEventLogEntry.create({
        actionBoardItemId: item._id,
        businessId: item.businessId,
        kind: r.kind,
        fromValue: r.fromValue,
        toValue: r.toValue,
        actorUserId: item.ownerId ?? null,
        actorLabel: "Showcase data",
        note: "",
        createdAt: r.createdAt,
      } as never);
      result.caseEvents++;
    }
  }

  // 4. Colleague goals and decisions for every group that has the Colleague product but none yet.
  for (const org of await ParentOrganization.find({})) {
    if (!hasProduct(org, "colleague_experience")) continue;
    const owner = await User.findOne({ accountType: "parent_org", parentId: org._id });
    if (!(await CxGoal.exists({ ownerType: "parentOrg", ownerId: org._id, product: "colleague_experience" }))) {
      await CxGoal.create({
        ownerType: "parentOrg",
        ownerId: org._id,
        product: "colleague_experience",
        label: "Lift eNPS to +25 by the end of the year",
        metric: "nps",
        categoryId: null,
        startValue: 5,
        targetValue: 25,
        targetDate: new Date(Date.now() + 120 * DAY),
        status: "active",
        createdBy: owner?._id ?? null,
      });
      result.colleagueGoals++;
    }
    if (!(await DecisionLogEntry.exists({ parentOrgId: org._id, product: "colleague_experience", autoCreated: { $ne: true } }))) {
      const branchIds = (await Business.find({ parentOrgId: org._id }).select("_id")).map((b) => b._id);
      await DecisionLogEntry.create({
        parentOrgId: org._id,
        product: "colleague_experience",
        title: "Publish rotas three weeks ahead",
        trigger: "Work-life balance was the lowest-scoring colleague category two quarters in a row.",
        affectedBusinessIds: branchIds,
        ownerId: owner?._id ?? null,
        implementationDate: daysAgo(75),
        status: "implemented",
        outcomeMetricDescription: "Average work-life balance rating",
        outcomeBefore: 2.9,
        outcomeAfter: 3.6,
        outcomeMeasuredAt: daysAgo(20),
        outcomeSampleSizeBefore: 64,
        outcomeSampleSizeAfter: 58,
      });
      await DecisionLogEntry.create({
        parentOrgId: org._id,
        product: "colleague_experience",
        title: "Add a monthly manager listening session",
        trigger: "Colleagues asked for more regular, informal contact with their manager.",
        affectedBusinessIds: branchIds,
        ownerId: owner?._id ?? null,
        implementationDate: null,
        status: "planned",
      });
      result.colleagueDecisions += 2;
    }
  }

  // 5. Playbooks for standalone businesses that have none (the page is empty otherwise).
  for (const b of await Business.find({ parentOrgId: null })) {
    if (!hasProduct(b, "customer_experience")) continue;
    if (await Playbook.exists({ businessId: b._id })) continue;
    await Playbook.create({
      businessId: b._id,
      parentOrgId: null,
      product: "customer_experience",
      title: "Recover a dissatisfied customer",
      triggerCondition: "A rating of 2 stars or below with a comment",
      steps: ["Read the full comment and any earlier feedback from the same visit", "Call or message the customer within one working day", "Offer a concrete fix or goodwill gesture", "Log what was agreed and close the case"],
    });
    await Playbook.create({
      businessId: b._id,
      parentOrgId: null,
      product: "customer_experience",
      title: "Investigate a repeated complaint",
      triggerCondition: "3+ mentions of the same issue in 2 weeks",
      triggerMetric: "negativeMentionCount",
      triggerComparator: "above",
      triggerThreshold: 3,
      triggerWindowDays: 14,
      steps: ["List every case that mentions the issue", "Find what changed (staff, supplier, process)", "Agree one fix and an owner", "Re-check the score two weeks after the fix"],
    });
    result.playbooks += 2;
  }

  return result;
}
