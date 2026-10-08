import type { Types } from "mongoose";

/** One person in a branch's escalation chain, lowest first. level is the 1-based position. */
export interface ChainStep {
  level: number;
  label: string;
  userId: string | null;
  tierKey: string; // "branch", a tier key, or "group"
}

export interface TreeChainInput {
  branchTitle: string;
  branchOwnerId: string | null;
  /** Boxes from the branch's own box up to the top tier, each with its manager. */
  nodes: { tierKey: string; tierName: string; managerTitle: string; managerUserId: string | null }[];
  groupSteps: { title: string; userId: string | null }[];
  /** Used as the top step when the group set no group-level steps. */
  fallbackHead: { userId: string | null; title: string } | null;
}

/**
 * Builds the escalation chain from a structure tree: the branch's own
 * manager first, then each box above it that has a manager (boxes with no
 * manager are skipped), then the group-level steps in order. A group that
 * set no steps ends at its owner ("Group Head"). Pure, so it is testable
 * without a database.
 */
export function buildTreeChain(input: TreeChainInput): ChainStep[] {
  const steps: Omit<ChainStep, "level">[] = [{ label: input.branchTitle || "Branch manager", userId: input.branchOwnerId, tierKey: "branch" }];
  for (const n of input.nodes) {
    if (!n.managerUserId) continue;
    steps.push({ label: n.managerTitle.trim() || `${n.tierName} manager`, userId: n.managerUserId, tierKey: n.tierKey });
  }
  const groupSteps = input.groupSteps.filter((g) => g.userId);
  if (groupSteps.length) {
    for (const g of groupSteps) steps.push({ label: g.title.trim() || "Group Head", userId: g.userId, tierKey: "group" });
  } else if (input.fallbackHead?.userId) {
    steps.push({ label: input.fallbackHead.title, userId: input.fallbackHead.userId, tierKey: "group" });
  }
  return steps.map((s, i) => ({ ...s, level: i + 1 }));
}

/** Position of a case's stored level in the chain. A level past the end (an older case after a restructure) counts as the top. */
export function chainIndexForLevel(chain: ChainStep[], level: number): number {
  if (!chain.length) return -1;
  const exact = chain.findIndex((c) => c.level === level);
  if (exact !== -1) return exact;
  return Math.min(Math.max(level - 1, 0), chain.length - 1);
}

/** Hours a case may sit at this step before it moves up: the step's own override, else the single group-wide number. */
export function slaHoursForStep(step: ChainStep, slaByTier: Record<string, number> | undefined, defaultHours: number | null): number | null {
  const own = slaByTier?.[step.tierKey];
  if (typeof own === "number" && own > 0) return own;
  return defaultHours && defaultHours > 0 ? defaultHours : null;
}

export type IdLike = string | Types.ObjectId | null | undefined;
export const idStr = (v: IdLike): string | null => (v ? String(v) : null);
