import { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { OrgNode, type IOrgNode } from "../models/OrgNode";
import { User } from "../models/User";
import { buildTreeChain, idStr } from "../structure/chain";

export interface VoteChain {
  businessId: Types.ObjectId | string;
  /** The people above the branch, lowest first. */
  people: { userId: string; title: string }[];
}

/**
 * Writes "escalates to" pointers from a set of per-branch chains: each branch
 * points at the first person in its chain, and each person points at the next
 * one up. Where a person sits in several chains with different people above
 * them, the most common next person wins. A person with no title yet gets the
 * one their step carried.
 */
export async function applyChainVotes(chains: VoteChain[]): Promise<void> {
  const nextVotes = new Map<string, Map<string, number>>();
  const titleFor = new Map<string, string>();
  const vote = (from: string, to: string | null) => {
    const key = to ?? "";
    const m = nextVotes.get(from) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + 1);
    nextVotes.set(from, m);
  };
  for (const c of chains) {
    const first = c.people[0]?.userId ?? null;
    await Business.updateOne({ _id: c.businessId }, { $set: { escalatesToUserId: first ? new Types.ObjectId(first) : null } });
    c.people.forEach((p, i) => {
      if (!titleFor.has(p.userId)) titleFor.set(p.userId, p.title);
      vote(p.userId, c.people[i + 1]?.userId ?? null);
    });
  }
  for (const [userId, votes] of nextVotes) {
    let best = "";
    let bestCount = -1;
    for (const [to, n] of votes) {
      if (n > bestCount) {
        best = to;
        bestCount = n;
      }
    }
    const user = await User.findById(userId).select("teamRole accountType");
    if (!user) continue;
    const set: Record<string, unknown> = { escalatesToUserId: best && best !== userId ? new Types.ObjectId(best) : null };
    if (!user.teamRole && user.accountType === "team_member" && titleFor.get(userId)) set.teamRole = titleFor.get(userId);
    await User.updateOne({ _id: userId }, { $set: set });
  }
}

/**
 * Turns the earlier tiers-and-boxes setup into "escalates to" pointers, so
 * nothing already configured is lost: every branch points at the first
 * person above it, and each person points at the next one up. Where one
 * person sat in different chains with different people above them, the most
 * common next person wins. Idempotent: a group already on pointers is left
 * alone. Used lazily the first time a converted group's chain is read, and
 * by a one-time migration.
 */
export async function convertTreeToPointers(opts: { parentOrgId?: Types.ObjectId | string; businessId?: Types.ObjectId | string }): Promise<{ converted: boolean }> {
  if (opts.parentOrgId) {
    const org = await ParentOrganization.findById(opts.parentOrgId);
    if (!org || !org.structure?.enabled || org.structure.model === "pointers") return { converted: false };

    const tierName = new Map((org.structure.tiers ?? []).map((t) => [t.key, t.name]));
    const head = await User.findOne({ accountType: "parent_org", parentId: org._id }).select("_id");
    const branches = await Business.find({ parentOrgId: org._id }).select("_id orgNodeId");
    const nodeCache = new Map<string, (IOrgNode & { _id: Types.ObjectId }) | null>();
    const chains: VoteChain[] = [];

    for (const b of branches) {
      const nodes: { tierKey: string; tierName: string; managerTitle: string; managerUserId: string | null }[] = [];
      let nodeId: Types.ObjectId | null = b.orgNodeId ?? null;
      for (let i = 0; nodeId && i < 12; i++) {
        const key = nodeId.toString();
        let node = nodeCache.get(key);
        if (node === undefined) {
          node = (await OrgNode.findById(nodeId)) as (IOrgNode & { _id: Types.ObjectId }) | null;
          nodeCache.set(key, node);
        }
        if (!node) break;
        nodes.push({ tierKey: node.tierKey, tierName: tierName.get(node.tierKey) ?? node.tierKey, managerTitle: node.managerTitle, managerUserId: idStr(node.managerUserId) });
        nodeId = node.parentNodeId;
      }
      const chain = buildTreeChain({
        branchTitle: org.structure.branchTitle,
        branchOwnerId: null,
        nodes,
        groupSteps: (org.structure.groupSteps ?? []).map((g) => ({ title: g.title, userId: idStr(g.userId) })),
        fallbackHead: head ? { userId: idStr(head._id), title: "Group Head" } : null,
      });
      // chain[0] is the branch itself; the rest are people.
      chains.push({ businessId: b._id, people: chain.slice(1).filter((p): p is typeof p & { userId: string } => !!p.userId).map((p) => ({ userId: p.userId, title: p.label })) });
    }
    await applyChainVotes(chains);

    await ParentOrganization.updateOne({ _id: org._id }, { $set: { "structure.model": "pointers" } });
    return { converted: true };
  }

  if (opts.businessId) {
    const business = await Business.findById(opts.businessId);
    if (!business || business.parentOrgId || !business.structure?.enabled || business.structure.model === "pointers") return { converted: false };
    const steps = (business.structure.groupSteps ?? []).filter((s) => s.userId);
    await Business.updateOne({ _id: business._id }, { $set: { escalatesToUserId: steps[0]?.userId ?? null, "structure.model": "pointers" } });
    for (let i = 0; i < steps.length; i++) {
      const next = steps[i + 1]?.userId ?? null;
      await User.updateOne({ _id: steps[i].userId }, { $set: { escalatesToUserId: next } });
    }
    return { converted: true };
  }
  return { converted: false };
}
