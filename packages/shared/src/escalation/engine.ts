import { Types, type HydratedDocument } from "mongoose";
import { Business, type IBusiness } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { EscalationAssignment } from "../models/EscalationAssignment";
import { ActionBoardItem, type IActionBoardItem } from "../models/ActionBoardItem";
import { OrgNode } from "../models/OrgNode";
import { User } from "../models/User";
import { sendTemplatedEmail } from "../email/resend";
import type { IEscalationLevel } from "../models/common";
import { buildTreeChain, chainIndexForLevel, slaHoursForStep, idStr, type ChainStep } from "../structure/chain";

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
async function legacyAssignee(businessId: string, level: number): Promise<Types.ObjectId | null> {
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


export interface BusinessChain {
  mode: "tree" | "legacy";
  chain: ChainStep[];
  slaHours: number | null;
  slaByTier: Record<string, number>;
}

/**
 * The escalation chain for one business, lowest step first. A group (or
 * standalone business) on the new structure gets its chain from its tree:
 * branch manager, each box above that has a manager, then the group-level
 * steps. One still on the older numbered levels keeps working unchanged, so
 * nothing already in flight breaks when this ships.
 */
export async function getChainForBusiness(business: HydratedDocument<IBusiness>): Promise<BusinessChain> {
  const org = business.parentOrgId ? await ParentOrganization.findById(business.parentOrgId) : null;
  const structure = org ? org.structure : business.structure;
  const slaHours = org ? org.escalationSlaHours : business.escalationSlaHours ?? null;

  if (structure?.enabled) {
    const branchOwner = await User.findOne({ accountType: "business", parentId: business._id }).select("_id");
    const tierName = new Map((structure.tiers ?? []).map((t) => [t.key, t.name]));
    const nodes: { tierKey: string; tierName: string; managerTitle: string; managerUserId: string | null }[] = [];
    let nodeId = org ? business.orgNodeId : null;
    for (let i = 0; nodeId && i < 12; i++) {
      const node = await OrgNode.findById(nodeId);
      if (!node) break;
      nodes.push({ tierKey: node.tierKey, tierName: tierName.get(node.tierKey) ?? node.tierKey, managerTitle: node.managerTitle, managerUserId: idStr(node.managerUserId) });
      nodeId = node.parentNodeId;
    }
    const head = org ? await User.findOne({ accountType: "parent_org", parentId: org._id }).select("_id") : null;
    const chain = buildTreeChain({
      branchTitle: structure.branchTitle,
      branchOwnerId: idStr(branchOwner?._id),
      nodes,
      groupSteps: (structure.groupSteps ?? []).map((g) => ({ title: g.title, userId: idStr(g.userId) })),
      fallbackHead: head ? { userId: idStr(head._id), title: "Group Head" } : null,
    });
    return { mode: "tree", chain, slaHours, slaByTier: (structure.slaByTier ?? {}) as Record<string, number> };
  }

  const config = await getEscalationConfig(business);
  const levels = config.levels.slice().sort((a, b) => a.level - b.level);
  const chain: ChainStep[] = [];
  for (const l of levels) {
    const userId = await legacyAssignee(business._id.toString(), l.level);
    chain.push({ level: l.level, label: l.label, userId: idStr(userId), tierKey: l.level <= 1 ? "branch" : "group" });
  }
  return { mode: "legacy", chain, slaHours: config.slaHours, slaByTier: {} };
}

/** Who holds a given level for this business right now (level 1 is always the branch's own owner). */
export async function resolveEscalationAssignee(businessId: string, level: number): Promise<Types.ObjectId | null> {
  const business = await Business.findById(businessId);
  if (!business) return null;
  const { chain } = await getChainForBusiness(business);
  const step = chain.find((c) => c.level === level);
  return step?.userId ? new Types.ObjectId(step.userId) : null;
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

  const { chain } = await getChainForBusiness(business);
  if (chain.length <= 1) throw new EscalationError("No one is set up above the branch yet. Add the escalation people first.");

  const currentIndex = chainIndexForLevel(chain, item.currentEscalationLevel);
  const nextLevelConfig = chain[currentIndex + 1];
  if (!nextLevelConfig) throw new EscalationError("This case is already at the top of the escalation chain.");

  const nextUserId = nextLevelConfig.userId ? new Types.ObjectId(nextLevelConfig.userId) : null;
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

  const { chain } = await getChainForBusiness(business);
  const currentIndex = chainIndexForLevel(chain, item.currentEscalationLevel);
  const prevLevelConfig = currentIndex <= 0 ? null : chain[currentIndex - 1];
  if (!prevLevelConfig) throw new EscalationError("This case is already at the bottom of the escalation chain.");

  const prevUserId = prevLevelConfig.userId ? new Types.ObjectId(prevLevelConfig.userId) : null;
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
      const { chain, slaHours, slaByTier } = await getChainForBusiness(business);
      const levelStarted = item.levelEnteredAt ?? item.createdAt;
      const hoursSince = (Date.now() - new Date(levelStarted).getTime()) / (1000 * 60 * 60);
      const step = chain[chainIndexForLevel(chain, item.currentEscalationLevel)];
      const limit = step ? slaHoursForStep(step, slaByTier, slaHours) : null;
      if (!limit || hoursSince < limit) {
        skipped++;
        continue;
      }
      await escalateActionBoardItem(item, { note: "Auto-escalated: unresolved past the time allowed at this step.", auto: true });
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

/** What the Escalate / Step back buttons need: who a click would hand the case to, shown before the click. */
export async function describeEscalation(businessId: string, currentLevel: number) {
  const business = await Business.findById(businessId);
  const empty = { levelsConfigured: 0, topLevel: null as number | null, canEscalate: false, canDeEscalate: false, nextLevel: null as null | { level: number; label: string; assigneeEmail: string | null }, prevLevel: null as null | { level: number; label: string; assigneeEmail: string | null } };
  if (!business) return empty;
  const { chain } = await getChainForBusiness(business);
  if (!chain.length) return empty;
  const i = chainIndexForLevel(chain, currentLevel);
  const next = chain[i + 1] ?? null;
  const prev = i > 0 ? chain[i - 1] : null;
  const ids = [next?.userId, prev?.userId].filter((x): x is string => !!x);
  const users = ids.length ? await User.find({ _id: { $in: ids } }).select("email") : [];
  const emailOf = (id: string | null | undefined) => (id ? users.find((u) => u._id.toString() === id)?.email ?? null : null);
  return {
    levelsConfigured: chain.length,
    topLevel: chain[chain.length - 1].level,
    canEscalate: !!next,
    canDeEscalate: !!prev,
    nextLevel: next ? { level: next.level, label: next.label, assigneeEmail: emailOf(next.userId) } : null,
    prevLevel: prev ? { level: prev.level, label: prev.label, assigneeEmail: emailOf(prev.userId) } : null,
  };
}
