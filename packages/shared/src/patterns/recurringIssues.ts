import { Types } from "mongoose";
import { CategoryOwnerMapping, type ICategoryOwnerMapping } from "../models/CategoryOwnerMapping";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { RecurringIssueFlag } from "../models/RecurringIssueFlag";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Recomputes every active recurring-issue flag across every
 * CategoryOwnerMapping that has repeat detection turned on
 * (repeatThresholdCount/repeatWindowDays set — off by default, an account
 * opts in per category). Called from the hourly evaluate-baseline-alerts
 * cron — same cadence as the other pattern-detection sweeps (regional
 * outlier / sudden drop), no dedicated cron needed.
 *
 * A "business"-scope mapping flags a repeat within one business/branch's
 * own cases. A "parentOrg"-scope mapping only ever flags a repeat that
 * genuinely spans 2+ distinct branches — if every matching case actually
 * came from a single branch, that's that branch's own business-scope
 * flag's job to raise, not the org's, so the org-level flag is dismissed
 * (or never created) in that case.
 */
export async function evaluateRecurringIssuesForAllOwners(): Promise<void> {
  const mappings = await CategoryOwnerMapping.find({
    repeatThresholdCount: { $ne: null },
    repeatWindowDays: { $ne: null },
  });

  for (const mapping of mappings) {
    await evaluateOneMapping(mapping);
  }
}

async function evaluateOneMapping(mapping: ICategoryOwnerMapping & { _id: Types.ObjectId }): Promise<void> {
  const threshold = mapping.repeatThresholdCount;
  const windowDays = mapping.repeatWindowDays;
  if (!threshold || !windowDays) return;

  const since = new Date(Date.now() - windowDays * DAY_MS);
  const businessFilter =
    mapping.ownerScope === "business" ? { businessId: mapping.ownerScopeId } : { parentOrgId: mapping.ownerScopeId };

  const cases = await ActionBoardItem.find({
    ...businessFilter,
    categoryId: mapping.categoryId,
    createdAt: { $gte: since },
  })
    .select("_id businessId createdAt")
    .sort({ createdAt: 1 });

  const existingActive = await RecurringIssueFlag.findOne({
    ownerScope: mapping.ownerScope,
    ownerScopeId: mapping.ownerScopeId,
    categoryId: mapping.categoryId,
    status: "active",
  });

  const distinctBusinessIds = [...new Set(cases.map((c) => c.businessId.toString()))];
  const isCrossBranchEnough = mapping.ownerScope !== "parentOrg" || distinctBusinessIds.length >= 2;
  const meetsThreshold = cases.length >= threshold && isCrossBranchEnough;

  if (!meetsThreshold) {
    if (existingActive) {
      existingActive.status = "dismissed";
      existingActive.dismissedAt = new Date();
      await existingActive.save();
    }
    return;
  }

  const caseIds = cases.map((c) => c._id);
  const businessIds = distinctBusinessIds.map((id) => new Types.ObjectId(id));
  const firstCaseAt = cases[0].createdAt;
  const lastCaseAt = cases[cases.length - 1].createdAt;

  if (existingActive) {
    existingActive.caseIds = caseIds;
    existingActive.businessIds = businessIds;
    existingActive.count = cases.length;
    existingActive.windowDays = windowDays;
    existingActive.firstCaseAt = firstCaseAt;
    existingActive.lastCaseAt = lastCaseAt;
    await existingActive.save();
    return;
  }

  await RecurringIssueFlag.create({
    ownerScope: mapping.ownerScope,
    ownerScopeId: mapping.ownerScopeId,
    categoryId: mapping.categoryId,
    caseIds,
    businessIds,
    count: cases.length,
    windowDays,
    firstCaseAt,
    lastCaseAt,
    status: "active",
  });
}
