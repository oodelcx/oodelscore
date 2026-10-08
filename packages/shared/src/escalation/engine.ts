import { Types, type HydratedDocument } from "mongoose";
import { Business, type IBusiness } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { EscalationAssignment } from "../models/EscalationAssignment";
import { ActionBoardItem, type IActionBoardItem } from "../models/ActionBoardItem";
import { CategoryOwnerMapping } from "../models/CategoryOwnerMapping";
import { User } from "../models/User";
import { sendTemplatedEmail } from "../email/resend";
import type { IEscalationLevel } from "../models/common";

/**
 * A category can opt into its own escalation threshold (set on Category
 * Owners, independent of the region-based EscalationAssignment system) —
 * "if a case in this category sits unresolved past N days, jump it
 * straight to level X," for a category whose severity warrants a
 * different path than the account's default SLA. Returns null when the
 * item has no category or the category never opted in, in which case the
 * caller falls back to the normal account-wide SLA sweep.
 */
async function getCategoryEscalationOverride(
  item: Pick<IActionBoardItem, "businessId" | "parentOrgId" | "categoryId">
): Promise<{ afterDays: number; toLevel: number } | null> {
  if (!item.categoryId) return null;
  const mapping = item.parentOrgId
    ? await CategoryOwnerMapping.findOne({ ownerScope: "parentOrg", ownerScopeId: item.parentOrgId, categoryId: item.categoryId })
    : await CategoryOwnerMapping.findOne({ ownerScope: "business", ownerScopeId: item.businessId, categoryId: item.categoryId });
  if (!mapping || mapping.escalateAfterDays === null || mapping.escalateToLevel === null) return null;
  return { afterDays: mapping.escalateAfterDays, toLevel: mapping.escalateToLevel };
}

export class EscalationError extends Error {}

export interface EscalationConfig {
  levels: IEscalationLevel[];
  slaHours: number | null;
}

/**
 * A branch's escalation chain always comes from its parent org when it has
 * one (same inheritance rule as ragThresholds) — a branch's own
 * escalationLevels field only applies while it's standalone. Exported so
 * the case detail routes can tell the UI up front whether Escalate/
 * De-escalate would even do anything, instead of the button only revealing
 * "nothing configured" after a click (see EscalationError's messages
 * below) — an account that never configured level 2+ (the schema default
 * is a single level, "Owner") would otherwise see a dead-end button with
 * no explanation.
 */
export async function getEscalationConfig(business: Pick<IBusiness, "parentOrgId" | "escalationLevels" | "escalationSlaHours">): Promise<EscalationConfig> {
  if (business.parentOrgId) {
    const org = await ParentOrganization.findById(business.parentOrgId);
    if (org) return { levels: org.escalationLevels, slaHours: org.escalationSlaHours };
  }
  return { levels: business.escalationLevels ?? [], slaHours: business.escalationSlaHours ?? null };
}

/**
 * Who holds a given level for this business right now. Level 1 is always
 * the business's own owner login — never configured via EscalationAssignment
 * — so onboarding only ever has to assign level 2 and up. For level 2+,
 * checks (in order) a branch-specific override, a region-scoped assignment,
 * then an org-wide/business-wide one.
 */
export async function resolveEscalationAssignee(businessId: string, level: number): Promise<Types.ObjectId | null> {
  const business = await Business.findById(businessId);
  if (!business) return null;

  if (level <= 1) {
    const owner = await User.findOne({ accountType: "business", parentId: business._id });
    return owner?._id ?? null;
  }

  if (business.parentOrgId) {
    const branchOverride = await EscalationAssignment.findOne({
      parentOrgId: business.parentOrgId,
      businessId: business._id,
      level,
    });
    if (branchOverride) return branchOverride.userId;

    if (business.region) {
      const regionMatch = await EscalationAssignment.findOne({
        parentOrgId: business.parentOrgId,
        businessId: null,
        region: business.region,
        level,
      });
      if (regionMatch) return regionMatch.userId;
    }

    const orgWide = await EscalationAssignment.findOne({
      parentOrgId: business.parentOrgId,
      businessId: null,
      region: "",
      level,
    });
    return orgWide?.userId ?? null;
  }

  const businessWide = await EscalationAssignment.findOne({ businessId: business._id, level });
  return businessWide?.userId ?? null;
}

/**
 * Advances one case to the next configured level: records the outgoing
 * level in escalationHistory (never edited afterward — this is the case's
 * audit trail), reassigns to whoever holds the next level, and notifies
 * them. Throws EscalationError (not a bare Error) for expected refusals —
 * no levels configured, or already at the top — so callers can tell those
 * apart from a real failure.
 */
export async function escalateActionBoardItem(
  item: HydratedDocument<IActionBoardItem>,
  opts: { note: string; auto?: boolean; byUserId?: Types.ObjectId | string | null }
): Promise<HydratedDocument<IActionBoardItem>> {
  const business = await Business.findById(item.businessId);
  if (!business) throw new EscalationError("Business not found");

  const config = await getEscalationConfig(business);
  const levels = config.levels.slice().sort((a, b) => a.level - b.level);
  if (!levels.length) throw new EscalationError("No escalation levels configured for this account yet.");

  const currentIndex = levels.findIndex((l) => l.level === item.currentEscalationLevel);
  const nextLevelConfig = currentIndex === -1 ? levels[0] : levels[currentIndex + 1];
  if (!nextLevelConfig) throw new EscalationError("This case is already at the top of the escalation chain.");

  const nextUserId = await resolveEscalationAssignee(item.businessId.toString(), nextLevelConfig.level);
  item.escalationHistory.push({
    level: item.currentEscalationLevel,
    userId: item.ownerId,
    action: opts.auto ? "auto_escalated" : "escalated",
    note: opts.note,
    at: new Date(),
    byUserId: opts.byUserId ? new Types.ObjectId(String(opts.byUserId)) : null,
    toUserId: nextUserId ?? null,
    toLevel: nextLevelConfig.level,
    toLabel: nextLevelConfig.label,
  });

  item.currentEscalationLevel = nextLevelConfig.level;
  item.levelEnteredAt = new Date();

  if (nextUserId) item.ownerId = nextUserId;

  await item.save();

  if (nextUserId) {
    const recipient = await User.findById(nextUserId);
    if (recipient) {
      await sendTemplatedEmail("case_escalated", recipient.email, {
        name: recipient.email,
        level_label: nextLevelConfig.label,
        business_name: business.name,
        action_title: item.title,
        escalation_note: opts.note || "(no note added)",
        action_link: `${process.env.APP_URL ?? ""}/business/action-board`,
      }).catch((err) => console.error("[escalation] failed to send case_escalated", err));
    }
  }

  return item;
}

/**
 * The corrective counterpart to escalateActionBoardItem: steps a case back
 * down one configured level — for when it was escalated too eagerly, or the
 * issue turned out simpler than it looked. Records the move in
 * escalationHistory with action "de_escalated" (same append-only array,
 * never edited afterward), reassigns to whoever holds the lower level, and
 * notifies them, mirroring escalate's own notification. Refuses at level 1
 * — there's nowhere lower to go.
 */
export async function deEscalateActionBoardItem(
  item: HydratedDocument<IActionBoardItem>,
  opts: { note: string; byUserId?: Types.ObjectId | string | null }
): Promise<HydratedDocument<IActionBoardItem>> {
  const business = await Business.findById(item.businessId);
  if (!business) throw new EscalationError("Business not found");

  const config = await getEscalationConfig(business);
  const levels = config.levels.slice().sort((a, b) => a.level - b.level);
  if (!levels.length) throw new EscalationError("No escalation levels configured for this account yet.");

  const currentIndex = levels.findIndex((l) => l.level === item.currentEscalationLevel);
  const prevLevelConfig = currentIndex <= 0 ? null : levels[currentIndex - 1];
  if (!prevLevelConfig) throw new EscalationError("This case is already at the bottom of the escalation chain.");

  const prevUserId = await resolveEscalationAssignee(item.businessId.toString(), prevLevelConfig.level);
  item.escalationHistory.push({
    level: item.currentEscalationLevel,
    userId: item.ownerId,
    action: "de_escalated",
    note: opts.note,
    at: new Date(),
    byUserId: opts.byUserId ? new Types.ObjectId(String(opts.byUserId)) : null,
    toUserId: prevUserId ?? null,
    toLevel: prevLevelConfig.level,
    toLabel: prevLevelConfig.label,
  });

  item.currentEscalationLevel = prevLevelConfig.level;
  item.levelEnteredAt = new Date();

  if (prevUserId) item.ownerId = prevUserId;

  await item.save();

  if (prevUserId) {
    const recipient = await User.findById(prevUserId);
    if (recipient) {
      await sendTemplatedEmail("case_escalated", recipient.email, {
        name: recipient.email,
        level_label: prevLevelConfig.label,
        business_name: business.name,
        action_title: item.title,
        escalation_note: opts.note || "(de-escalated, no note added)",
        action_link: `${process.env.APP_URL ?? ""}/business/action-board`,
      }).catch((err) => console.error("[escalation] failed to send case_escalated (de-escalate)", err));
    }
  }

  return item;
}

/**
 * The cron's sweep: any open case that's been sitting at its current level
 * longer than its owner's configured escalationSlaHours gets bumped one
 * level automatically. Already-at-the-top and no-levels-configured are
 * expected outcomes (skipped silently), not failures — only an unexpected
 * error counts toward `failed`.
 */
export async function autoEscalateOverdueCases(): Promise<{ escalated: number; skipped: number; failed: number }> {
  let escalated = 0;
  let skipped = 0;
  let failed = 0;

  // Sensitive cases stay with their confidential contact: never auto-moved up or down a chain.
  const items = await ActionBoardItem.find({ status: { $ne: "resolved" }, sensitive: { $ne: true } });
  for (const item of items) {
    try {
      const business = await Business.findById(item.businessId);
      if (!business) {
        skipped++;
        continue;
      }
      const config = await getEscalationConfig(business);
      const levelStarted = item.levelEnteredAt ?? item.createdAt;
      const hoursSince = (Date.now() - new Date(levelStarted).getTime()) / (1000 * 60 * 60);

      // A category-specific override takes priority over the account-wide
      // SLA sweep: if this case's category opted into its own threshold and
      // it's overdue, jump straight to that category's configured level
      // (one escalateActionBoardItem call per rung, since escalationHistory
      // needs an entry for each level actually passed through) rather than
      // advancing only one level the way the default SLA sweep does.
      const categoryOverride = await getCategoryEscalationOverride(item);
      if (categoryOverride && hoursSince >= categoryOverride.afterDays * 24) {
        let movedAny = false;
        while (item.currentEscalationLevel < categoryOverride.toLevel) {
          try {
            await escalateActionBoardItem(item, {
              note: `Auto-escalated: this category is configured to escalate to level ${categoryOverride.toLevel} after ${categoryOverride.afterDays} day(s) unresolved.`,
              auto: true,
            });
            movedAny = true;
          } catch (err) {
            if (err instanceof EscalationError) break;
            throw err;
          }
        }
        if (movedAny) {
          escalated++;
          continue;
        }
      }

      if (!config.slaHours) {
        skipped++;
        continue;
      }
      if (hoursSince < config.slaHours) {
        skipped++;
        continue;
      }
      await escalateActionBoardItem(item, { note: "Auto-escalated: unresolved past the SLA at this level.", auto: true });
      escalated++;
    } catch (err) {
      if (err instanceof EscalationError) {
        skipped++;
        continue;
      }
      console.error("[escalation] auto-escalate failed for item", item._id.toString(), err);
      failed++;
    }
  }

  return { escalated, skipped, failed };
}
