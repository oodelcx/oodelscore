import type { HydratedDocument, Types } from "mongoose";
import { Business, type IBusiness } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { EscalationAssignment } from "../models/EscalationAssignment";
import { ActionBoardItem, type IActionBoardItem } from "../models/ActionBoardItem";
import { User } from "../models/User";
import { sendTemplatedEmail } from "../email/resend";
import type { IEscalationLevel } from "../models/common";

export class EscalationError extends Error {}

interface EscalationConfig {
  levels: IEscalationLevel[];
  slaHours: number | null;
}

/**
 * A branch's escalation chain always comes from its parent org when it has
 * one (same inheritance rule as ragThresholds) — a branch's own
 * escalationLevels field only applies while it's standalone.
 */
async function getEscalationConfig(business: Pick<IBusiness, "parentOrgId" | "escalationLevels" | "escalationSlaHours">): Promise<EscalationConfig> {
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
  opts: { note: string; auto?: boolean }
): Promise<HydratedDocument<IActionBoardItem>> {
  const business = await Business.findById(item.businessId);
  if (!business) throw new EscalationError("Business not found");

  const config = await getEscalationConfig(business);
  const levels = config.levels.slice().sort((a, b) => a.level - b.level);
  if (!levels.length) throw new EscalationError("No escalation levels configured for this account yet.");

  const currentIndex = levels.findIndex((l) => l.level === item.currentEscalationLevel);
  const nextLevelConfig = currentIndex === -1 ? levels[0] : levels[currentIndex + 1];
  if (!nextLevelConfig) throw new EscalationError("This case is already at the top of the escalation chain.");

  item.escalationHistory.push({
    level: item.currentEscalationLevel,
    userId: item.ownerId,
    action: opts.auto ? "auto_escalated" : "escalated",
    note: opts.note,
    at: new Date(),
  });

  item.currentEscalationLevel = nextLevelConfig.level;
  item.levelEnteredAt = new Date();

  const nextUserId = await resolveEscalationAssignee(item.businessId.toString(), nextLevelConfig.level);
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

  const items = await ActionBoardItem.find({ status: { $ne: "resolved" } });
  for (const item of items) {
    try {
      const business = await Business.findById(item.businessId);
      if (!business) {
        skipped++;
        continue;
      }
      const config = await getEscalationConfig(business);
      if (!config.slaHours) {
        skipped++;
        continue;
      }
      const levelStarted = item.levelEnteredAt ?? item.createdAt;
      const hoursSince = (Date.now() - new Date(levelStarted).getTime()) / (1000 * 60 * 60);
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
