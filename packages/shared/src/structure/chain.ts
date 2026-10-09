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

/** A person who can hold a step in the chain. */
export interface PointerPerson {
  id: string;
  title: string; // "Cluster Manager"
  escalatesToId: string | null;
}

export interface PointerChainInput {
  branchTitle: string;
  branchOwnerId: string | null;
  /** The branch's own "escalates to" (a person), or null for the default. */
  firstPointerId: string | null;
  /** Everyone reachable from the pointers, by id. A pointer to someone missing here (removed) ends the chain at that point. */
  people: Map<string, PointerPerson>;
  /** The group head: where a branch with nobody set (or a broken pointer) goes. Null for a standalone business. */
  head: { id: string; title: string } | null;
  maxDepth?: number;
}

export interface PointerChainResult {
  chain: ChainStep[];
  /** What is wrong with this branch's setup, in plain words. Empty when the chain is clean. */
  issues: ("nobody_set" | "pointer_removed" | "loop" | "too_long")[];
}

/**
 * Builds a branch's escalation chain by following "escalates to" pointers:
 * the branch's own manager first, then whoever the branch points to, then
 * whoever that person points to, and so on until someone points to nobody.
 * A branch with no pointer goes to the group head. A pointer to a removed
 * person, a loop, or an over-long chain is cut off, reported in `issues`,
 * and (for a removed person) falls back to the group head so a case is
 * never stranded. Pure, so it is testable without a database.
 */
export function buildPointerChain(input: PointerChainInput): PointerChainResult {
  const max = input.maxDepth ?? 12;
  const issues: PointerChainResult["issues"] = [];
  const steps: Omit<ChainStep, "level">[] = [{ label: input.branchTitle || "Branch manager", userId: input.branchOwnerId, tierKey: "branch" }];
  const seen = new Set<string>(input.branchOwnerId ? [input.branchOwnerId] : []);

  let cur: string | null = input.firstPointerId;
  if (!cur) {
    if (input.head) {
      cur = input.head.id;
      issues.push("nobody_set");
    }
  }
  let depth = 0;
  while (cur) {
    if (seen.has(cur)) {
      issues.push("loop");
      break;
    }
    if (depth >= max) {
      issues.push("too_long");
      break;
    }
    const person: PointerPerson | undefined = input.people.get(cur) ?? (input.head && cur === input.head.id ? { id: input.head.id, title: input.head.title, escalatesToId: null } : undefined);
    if (!person) {
      issues.push("pointer_removed");
      break;
    }
    seen.add(cur);
    steps.push({ label: person.title.trim() || "Escalation contact", userId: person.id, tierKey: "step" });
    cur = person.escalatesToId;
    depth++;
  }
  // A pointer to someone removed must not strand the case: fall back to the group head.
  if (steps.length === 1 && input.head && !seen.has(input.head.id)) {
    steps.push({ label: input.head.title, userId: input.head.id, tierKey: "step" });
  }
  return { chain: steps.map((s, i) => ({ ...s, level: i + 1 })), issues };
}

/**
 * Would pointing `fromId` at `toId` create a loop? True when following
 * pointers from `toId` reaches `fromId` again (or `toId` is `fromId`).
 */
export function wouldCreateLoop(fromId: string, toId: string, escalatesTo: Map<string, string | null>, maxDepth = 50): boolean {
  let cur: string | null = toId;
  for (let i = 0; cur && i < maxDepth; i++) {
    if (cur === fromId) return true;
    cur = escalatesTo.get(cur) ?? null;
  }
  return false;
}
