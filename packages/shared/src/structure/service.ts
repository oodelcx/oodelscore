import { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { OrgNode } from "../models/OrgNode";
import { User } from "../models/User";
import { EscalationAssignment } from "../models/EscalationAssignment";
import { getChainForBusiness } from "../escalation/engine";
import { idStr } from "./chain";

export type StructureOwner = { kind: "parentOrg"; id: string } | { kind: "business"; id: string };

export class StructureError extends Error {}

const DEFAULT_TIERS = [
  { key: "region", name: "Region" },
  { key: "area", name: "Area" },
  { key: "cluster", name: "Cluster" },
];

function slugKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "tier";
}

async function loadOwner(owner: StructureOwner) {
  if (owner.kind === "parentOrg") {
    const org = await ParentOrganization.findById(owner.id);
    if (!org) throw new StructureError("Organization not found");
    return { org, business: null };
  }
  const business = await Business.findById(owner.id);
  if (!business) throw new StructureError("Business not found");
  if (business.parentOrgId) throw new StructureError("This business is a branch. Its group manages escalation.");
  return { org: null, business };
}

/** People who can hold an escalation step: the owner and the team of this account (and, for a group, its branch owners). */
async function loadCandidates(owner: StructureOwner) {
  if (owner.kind === "parentOrg") {
    const branches = await Business.find({ parentOrgId: owner.id, active: true }).select("name");
    const nameById = new Map(branches.map((b) => [b._id.toString(), b.name]));
    const users = await User.find({
      $or: [
        { accountType: "parent_org", parentId: owner.id },
        { accountType: "team_member", teamOfType: "parentOrg", parentId: owner.id },
        { accountType: "business", parentId: { $in: branches.map((b) => b._id) } },
      ],
    }).select("email accountType teamRole parentId");
    return users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      label:
        u.accountType === "parent_org"
          ? `${u.email} (group owner)`
          : u.accountType === "business"
            ? `${u.email} (${nameById.get(u.parentId?.toString() ?? "") ?? "branch"})`
            : u.teamRole
              ? `${u.email} (${u.teamRole})`
              : u.email,
    }));
  }
  const users = await User.find({
    $or: [
      { accountType: "business", parentId: owner.id },
      { accountType: "team_member", teamOfType: "business", parentId: owner.id },
    ],
  }).select("email accountType teamRole");
  return users.map((u) => ({ id: u._id.toString(), email: u.email, label: u.accountType === "business" ? `${u.email} (owner)` : u.teamRole ? `${u.email} (${u.teamRole})` : u.email }));
}

async function userIdForEmail(owner: StructureOwner, email: unknown): Promise<Types.ObjectId | null> {
  if (typeof email !== "string" || !email.trim()) return null;
  const candidates = await loadCandidates(owner);
  const hit = candidates.find((c) => c.email.toLowerCase() === email.trim().toLowerCase());
  if (!hit) throw new StructureError(`${email.trim()} is not on this account's team. Ask your OodelCX account manager to add them as a team member first.`);
  return new Types.ObjectId(hit.id);
}

export async function loadStructure(owner: StructureOwner) {
  const { org, business } = await loadOwner(owner);
  const structure = org ? org.structure : business!.structure;
  const emailById = new Map<string, string>();
  const candidates = await loadCandidates(owner);
  for (const c of candidates) emailById.set(c.id, c.email);

  const nodes = org ? await OrgNode.find({ parentOrgId: org._id }).sort({ name: 1 }) : [];
  const branches = org ? await Business.find({ parentOrgId: org._id, active: true }).select("name region orgNodeId").sort({ name: 1 }) : [];
  const branchCountByNode = new Map<string, number>();
  for (const b of branches) if (b.orgNodeId) branchCountByNode.set(b.orgNodeId.toString(), (branchCountByNode.get(b.orgNodeId.toString()) ?? 0) + 1);

  const legacyAssignments = org
    ? await EscalationAssignment.find({ parentOrgId: org._id }).populate("userId", "email")
    : await EscalationAssignment.find({ businessId: business!._id }).populate("userId", "email");
  const legacyLevels = (org ? org.escalationLevels : business!.escalationLevels) ?? [];

  return {
    kind: owner.kind,
    name: org ? org.name : business!.name,
    enabled: !!structure?.enabled,
    tiers: (structure?.tiers ?? []).map((t) => ({ key: t.key, name: t.name })),
    branchTitle: structure?.branchTitle ?? "Branch manager",
    groupSteps: (structure?.groupSteps ?? []).map((g) => ({ title: g.title, email: g.userId ? emailById.get(g.userId.toString()) ?? "" : "" })),
    slaHours: org ? org.escalationSlaHours : business!.escalationSlaHours,
    slaByTier: (structure?.slaByTier ?? {}) as Record<string, number>,
    nodes: nodes.map((n) => ({
      id: n._id.toString(),
      tierKey: n.tierKey,
      name: n.name,
      parentNodeId: n.parentNodeId ? n.parentNodeId.toString() : null,
      managerEmail: n.managerUserId ? emailById.get(n.managerUserId.toString()) ?? "" : "",
      managerTitle: n.managerTitle,
      branchCount: branchCountByNode.get(n._id.toString()) ?? 0,
    })),
    branches: branches.map((b) => ({ id: b._id.toString(), name: b.name, region: b.region, orgNodeId: b.orgNodeId ? b.orgNodeId.toString() : null })),
    candidates: candidates.map((c) => ({ email: c.email, label: c.label })),
    legacy: {
      levels: legacyLevels.map((l) => ({ level: l.level, label: l.label })),
      assignmentCount: legacyAssignments.length,
      hasScoped: legacyAssignments.some((a) => a.region || a.businessId),
    },
  };
}

/** The chain one branch would follow, with emails, for the preview box. */
export async function previewChain(owner: StructureOwner, businessId: string) {
  let business;
  if (owner.kind === "parentOrg") {
    business = await Business.findOne({ _id: businessId, parentOrgId: owner.id });
  } else {
    business = await Business.findOne({ _id: owner.id });
  }
  if (!business) throw new StructureError("Branch not found");
  const { chain, mode, slaHours, slaByTier } = await getChainForBusiness(business);
  const users = await User.find({ _id: { $in: chain.map((c) => c.userId).filter((x): x is string => !!x) } }).select("email");
  const emailById = new Map(users.map((u) => [u._id.toString(), u.email]));
  return { mode, slaHours, steps: chain.map((c) => ({ level: c.level, label: c.label, email: c.userId ? emailById.get(c.userId) ?? "" : "", tierKey: c.tierKey, hours: c.tierKey && typeof slaByTier[c.tierKey] === "number" ? slaByTier[c.tierKey] : slaHours })) };
}

async function setStructure(owner: StructureOwner, patch: Record<string, unknown>, slaHours?: number | null) {
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) set[`structure.${k}`] = v;
  if (slaHours !== undefined) set.escalationSlaHours = slaHours;
  if (owner.kind === "parentOrg") await ParentOrganization.updateOne({ _id: owner.id }, { $set: set });
  else await Business.updateOne({ _id: owner.id }, { $set: set });
}

export async function applyStructureAction(owner: StructureOwner, body: Record<string, unknown>): Promise<void> {
  const { org } = await loadOwner(owner);
  const action = typeof body.action === "string" ? body.action : "";

  switch (action) {
    case "saveSettings": {
      const patch: Record<string, unknown> = { enabled: true };
      if (Array.isArray(body.tiers) && org) {
        const tiers = (body.tiers as { name?: unknown; key?: unknown }[])
          .map((t) => ({ name: typeof t.name === "string" ? t.name.trim() : "", key: typeof t.key === "string" ? t.key : "" }))
          .filter((t) => t.name);
        const used = new Set<string>();
        const clean = tiers.map((t) => {
          let key = t.key || slugKey(t.name);
          while (used.has(key)) key += "-2";
          used.add(key);
          return { key, name: t.name };
        });
        const existing = await OrgNode.distinct("tierKey", { parentOrgId: org._id });
        const dropped = existing.filter((k) => !clean.some((t) => t.key === k));
        if (dropped.length) throw new StructureError("A level that still has boxes under it cannot be removed. Delete or move those boxes first.");
        patch.tiers = clean;
      }
      if (typeof body.branchTitle === "string" && body.branchTitle.trim()) patch.branchTitle = body.branchTitle.trim();
      if (Array.isArray(body.groupSteps)) {
        const steps = [];
        for (const g of body.groupSteps as { title?: unknown; email?: unknown }[]) {
          const userId = await userIdForEmail(owner, g.email);
          if (!userId) continue;
          steps.push({ title: typeof g.title === "string" && g.title.trim() ? g.title.trim() : "Group Head", userId });
        }
        patch.groupSteps = steps;
      }
      if (body.slaByTier && typeof body.slaByTier === "object") {
        const clean: Record<string, number> = {};
        for (const [k, v] of Object.entries(body.slaByTier as Record<string, unknown>)) if (typeof v === "number" && v > 0) clean[k] = v;
        patch.slaByTier = clean;
      }
      let sla: number | null | undefined;
      if (body.slaHours === null) sla = null;
      else if (typeof body.slaHours === "number" && body.slaHours > 0) sla = body.slaHours;
      await setStructure(owner, patch, sla);
      return;
    }
    case "addNode": {
      if (!org) throw new StructureError("Only a group has a structure tree.");
      const tierKey = String(body.tierKey ?? "");
      if (!org.structure.tiers.some((t) => t.key === tierKey)) throw new StructureError("Unknown level.");
      const names = Array.isArray(body.names) ? (body.names as unknown[]).map((n) => String(n).trim()).filter(Boolean) : [String(body.name ?? "").trim()].filter(Boolean);
      if (!names.length) throw new StructureError("Enter a name.");
      const parentNodeId = body.parentNodeId ? new Types.ObjectId(String(body.parentNodeId)) : null;
      const managerUserId = await userIdForEmail(owner, body.managerEmail);
      for (const name of names) {
        await OrgNode.create({ parentOrgId: org._id, tierKey, name, parentNodeId, managerUserId, managerTitle: typeof body.managerTitle === "string" ? body.managerTitle.trim() : "" });
      }
      return;
    }
    case "updateNode": {
      if (!org) throw new StructureError("Only a group has a structure tree.");
      const node = await OrgNode.findOne({ _id: String(body.id), parentOrgId: org._id });
      if (!node) throw new StructureError("Box not found");
      if (typeof body.name === "string" && body.name.trim()) node.name = body.name.trim();
      if (body.managerEmail !== undefined) node.managerUserId = await userIdForEmail(owner, body.managerEmail);
      if (typeof body.managerTitle === "string") node.managerTitle = body.managerTitle.trim();
      if (body.parentNodeId !== undefined) node.parentNodeId = body.parentNodeId ? new Types.ObjectId(String(body.parentNodeId)) : null;
      await node.save();
      return;
    }
    case "deleteNode": {
      if (!org) throw new StructureError("Only a group has a structure tree.");
      const id = String(body.id);
      const [children, branches] = await Promise.all([OrgNode.countDocuments({ parentNodeId: id }), Business.countDocuments({ orgNodeId: id })]);
      if (children || branches) throw new StructureError("This box still has boxes or branches under it. Move them first.");
      await OrgNode.deleteOne({ _id: id, parentOrgId: org._id });
      return;
    }
    case "moveBranch": {
      if (!org) throw new StructureError("Only a group has a structure tree.");
      const nodeId = body.orgNodeId ? String(body.orgNodeId) : null;
      if (nodeId && !(await OrgNode.exists({ _id: nodeId, parentOrgId: org._id }))) throw new StructureError("Box not found");
      const ids: string[] = Array.isArray(body.businessIds) ? (body.businessIds as unknown[]).map(String) : [String(body.businessId)];
      await Business.updateMany({ _id: { $in: ids }, parentOrgId: org._id }, { $set: { orgNodeId: nodeId ? new Types.ObjectId(nodeId) : null } });
      return;
    }
    case "convertLegacy": {
      await convertLegacyToStructure(owner);
      return;
    }
    default:
      throw new StructureError("Unknown action");
  }
}

/**
 * Turns an older numbered-levels setup into the new structure. Levels that
 * were held org-wide become group steps, in order. Region-scoped holders
 * become a "Region" level with one box per region (the manager is whoever
 * held the lowest region-scoped level). Branch-specific overrides cannot be
 * mapped and are left out; the response says how many.
 */
export async function convertLegacyToStructure(owner: StructureOwner): Promise<{ skippedBranchOverrides: number }> {
  const { org, business } = await loadOwner(owner);
  const levels = ((org ? org.escalationLevels : business!.escalationLevels) ?? []).filter((l) => l.level > 1).sort((a, b) => a.level - b.level);
  const assignments = org ? await EscalationAssignment.find({ parentOrgId: org._id }) : await EscalationAssignment.find({ businessId: business!._id });
  const skippedBranchOverrides = assignments.filter((a) => a.parentOrgId && a.businessId).length;

  const orgWide = (lvl: number) => assignments.find((a) => !a.region && !a.businessId && a.level === lvl) ?? assignments.find((a) => !a.region && a.level === lvl && !(org && a.businessId));
  const groupSteps: { title: string; userId: Types.ObjectId }[] = [];
  const regionLevels = new Set(assignments.filter((a) => a.region).map((a) => a.level));
  const lowestRegionLevel = regionLevels.size ? Math.min(...regionLevels) : null;

  for (const l of levels) {
    if (l.level === lowestRegionLevel) continue; // becomes the region boxes' manager
    const a = orgWide(l.level);
    if (a) groupSteps.push({ title: l.label, userId: a.userId });
  }

  const patch: Record<string, unknown> = { enabled: true, groupSteps, branchTitle: "Branch manager" };
  if (org && lowestRegionLevel !== null) {
    patch.tiers = [{ key: "region", name: "Region" }];
    const regionTitle = levels.find((l) => l.level === lowestRegionLevel)?.label ?? "Regional manager";
    const regions = await Business.distinct("region", { parentOrgId: org._id, active: true });
    for (const region of regions.filter(Boolean)) {
      let node = await OrgNode.findOne({ parentOrgId: org._id, tierKey: "region", name: region });
      const holder = assignments.find((a) => a.region === region && a.level === lowestRegionLevel) ?? orgWide(lowestRegionLevel);
      if (!node) node = await OrgNode.create({ parentOrgId: org._id, tierKey: "region", name: region, parentNodeId: null, managerUserId: holder?.userId ?? null, managerTitle: regionTitle });
      await Business.updateMany({ parentOrgId: org._id, region }, { $set: { orgNodeId: node._id } });
    }
  } else if (org) {
    patch.tiers = [];
  }
  await setStructure(owner, patch);
  return { skippedBranchOverrides };
}

export { DEFAULT_TIERS };
