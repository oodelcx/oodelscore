import type { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { OrgNode } from "../models/OrgNode";
import { User } from "../models/User";
import { hashPassword } from "../auth/password";

const PASSWORD = "ocx123";
const LOGIN_DOMAIN = "ocx.test";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);

async function teamMember(orgId: Types.ObjectId, email: string, teamRole: string, products: ("customer_experience" | "colleague_experience")[] | null) {
  const passwordHash = await hashPassword(PASSWORD);
  return User.findOneAndUpdate(
    { email },
    {
      $set: {
        passwordHash,
        accountType: "team_member",
        parentId: orgId,
        teamRole,
        tier: "full",
        teamOfType: "parentOrg",
        products: products && products.length > 1 ? products : null,
        inviteStatus: "active",
        inviteTokenHash: null,
        inviteExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      $setOnInsert: { tokenVersion: 0 },
    },
    { upsert: true, new: true }
  );
}

export interface StructureDemoResult {
  orgsStructured: number;
  nodes: number;
  managers: number;
}

/**
 * Gives every group a real structure tree for the demo: a Region level (and a
 * Cluster level for the bigger groups), a named manager for every box, and
 * group steps (Operations Lead, then Group Head). Each branch is placed under
 * its region/cluster, so the Escalate button shows a real chain with emails.
 * Idempotent: a group that already has its structure switched on is left alone.
 */
export async function seedStructureDemo(): Promise<StructureDemoResult> {
  const result: StructureDemoResult = { orgsStructured: 0, nodes: 0, managers: 0 };
  const orgs = await ParentOrganization.find();
  for (const org of orgs) {
    if (org.structure?.enabled && (await OrgNode.exists({ parentOrgId: org._id }))) continue;
    const owner = await User.findOne({ accountType: "parent_org", parentId: org._id });
    if (!owner) continue;
    const key = owner.email.split("@")[0];
    const products = (org.enabledProducts ?? ["customer_experience"]) as ("customer_experience" | "colleague_experience")[];
    const branches = await Business.find({ parentOrgId: org._id, active: true }).sort({ name: 1 });
    if (!branches.length) continue;

    const useClusters = branches.length >= 6;
    const tiers = useClusters ? [{ key: "region", name: "Region" }, { key: "cluster", name: "Cluster" }] : [{ key: "region", name: "Region" }];

    const ops = await User.findOne({ email: `${key}.ops@${LOGIN_DOMAIN}` });
    const groupSteps: { title: string; userId: Types.ObjectId | null }[] = [];
    if (ops) groupSteps.push({ title: ops.teamRole || "Operations Lead", userId: ops._id });
    groupSteps.push({ title: "Group Head", userId: owner._id });

    await ParentOrganization.updateOne(
      { _id: org._id },
      { $set: { "structure.enabled": true, "structure.tiers": tiers, "structure.groupSteps": groupSteps, "structure.branchTitle": "Branch manager", "structure.slaByTier": {}, escalationSlaHours: org.escalationSlaHours ?? 48 } }
    );

    const regions = [...new Set(branches.map((b) => b.region || "Main"))].sort();
    for (const region of regions) {
      const email = `${key}.${slug(region)}@${LOGIN_DOMAIN}`;
      const mgr = await teamMember(org._id, email, `${region} Regional Manager`, products);
      result.managers++;
      let regionNode = await OrgNode.findOne({ parentOrgId: org._id, tierKey: "region", name: `${region} Region` });
      if (!regionNode) regionNode = await OrgNode.create({ parentOrgId: org._id, tierKey: "region", name: `${region} Region`, parentNodeId: null, managerUserId: mgr._id, managerTitle: `${region} Regional Manager` });
      result.nodes++;

      const inRegion = branches.filter((b) => (b.region || "Main") === region);
      if (!useClusters) {
        await Business.updateMany({ _id: { $in: inRegion.map((b) => b._id) } }, { $set: { orgNodeId: regionNode._id } });
        continue;
      }
      // Clusters: one per city for Precision (its branch names start with the city); otherwise groups of up to three branches.
      const byCity = key === "precision";
      const groups: { label: string; id: string; branches: typeof inRegion }[] = [];
      if (byCity) {
        for (const b of inRegion) {
          const city = b.name.split(" – ")[1]?.split(" ")[0] ?? "Main";
          const label = city === "Community" ? "Community Education" : `${city} Cluster`;
          const g = groups.find((x) => x.label === label);
          if (g) g.branches.push(b);
          else groups.push({ label, id: slug(city), branches: [b] });
        }
      } else {
        for (let i = 0; i < inRegion.length; i += 3) groups.push({ label: `${region} Cluster ${String.fromCharCode(65 + i / 3)}`, id: `${slug(region)}.c${String.fromCharCode(97 + i / 3)}`, branches: inRegion.slice(i, i + 3) });
      }
      for (const g of groups) {
        const chunk = g.branches;
        const label = g.label;
        const cMgr = await teamMember(org._id, `${key}.${g.id}@${LOGIN_DOMAIN}`, "Cluster Manager", products);
        result.managers++;
        let node = await OrgNode.findOne({ parentOrgId: org._id, tierKey: "cluster", name: label });
        if (!node) node = await OrgNode.create({ parentOrgId: org._id, tierKey: "cluster", name: label, parentNodeId: regionNode._id, managerUserId: cMgr._id, managerTitle: "Cluster Manager" });
        result.nodes++;
        await Business.updateMany({ _id: { $in: chunk.map((b) => b._id) } }, { $set: { orgNodeId: node._id } });
      }
    }
    result.orgsStructured++;
  }
  return result;
}
