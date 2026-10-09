import type { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { EscalationChangeLog } from "../models/EscalationChangeLog";
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
  people: number;
  branchesPointed: number;
}

/**
 * Gives every group a real "escalates to" setup for the demo. Each branch
 * points at the first person above it, and each person points at the next:
 *   branch -> cluster manager (bigger groups) -> regional manager
 *          -> operations lead -> (Precision only: quality lead) -> group head.
 * Precision Diagnostics gets the complete team (a manager for every region and
 * every city, plus a spare unassigned cluster manager for the "someone leaves"
 * demo) and exactly one free team seat, so adding one person works and the
 * next one shows the seat limit. Idempotent: a group already on pointers with
 * branches pointed is left alone.
 */
export async function seedStructureDemo(): Promise<StructureDemoResult> {
  const result: StructureDemoResult = { orgsStructured: 0, people: 0, branchesPointed: 0 };
  const orgs = await ParentOrganization.find();
  for (const org of orgs) {
    const owner = await User.findOne({ accountType: "parent_org", parentId: org._id });
    if (!owner) continue;
    const branches = await Business.find({ parentOrgId: org._id, active: true }).sort({ name: 1 });
    if (!branches.length) continue;
    if (org.structure?.enabled && org.structure.model === "pointers" && branches.some((b) => b.escalatesToUserId)) continue;

    const key = owner.email.split("@")[0];
    const isPrecision = key === "precision";
    const products = (org.enabledProducts ?? ["customer_experience"]) as ("customer_experience" | "colleague_experience")[];
    const useClusters = branches.length >= 6;

    const ops = await User.findOne({ email: `${key}.ops@${LOGIN_DOMAIN}` });
    const lead = isPrecision ? await User.findOne({ email: `${key}.lead@${LOGIN_DOMAIN}` }) : null;
    // Top of the group: ops -> (lead) -> head.
    const upper: { id: Types.ObjectId }[] = [];
    if (ops) upper.push({ id: ops._id });
    if (lead) upper.push({ id: lead._id });
    for (let i = 0; i < upper.length; i++) {
      await User.updateOne({ _id: upper[i].id }, { $set: { escalatesToUserId: upper[i + 1]?.id ?? owner._id } });
    }
    await User.updateOne({ _id: owner._id }, { $set: { escalatesToUserId: null } });
    const aboveRegion = upper[0]?.id ?? owner._id;

    const regions = [...new Set(branches.map((b) => b.region || "Main"))].sort();
    for (const region of regions) {
      const mgr = await teamMember(org._id, `${key}.${slug(region)}@${LOGIN_DOMAIN}`, `${region} Regional Manager`, products);
      await User.updateOne({ _id: mgr._id }, { $set: { escalatesToUserId: aboveRegion } });
      result.people++;

      const inRegion = branches.filter((b) => (b.region || "Main") === region);
      if (!useClusters) {
        await Business.updateMany({ _id: { $in: inRegion.map((b) => b._id) } }, { $set: { escalatesToUserId: mgr._id } });
        result.branchesPointed += inRegion.length;
        continue;
      }
      // Clusters: one per city for Precision (its branch names start with the city); otherwise groups of up to three branches.
      const groups: { label: string; id: string; branches: typeof inRegion }[] = [];
      if (isPrecision) {
        for (const b of inRegion) {
          const city = b.name.split(" – ")[1]?.split(" ")[0] ?? "Main";
          const label = city === "Community" ? "Community Education" : `${city} Cluster Manager`;
          const g = groups.find((x) => x.label === label);
          if (g) g.branches.push(b);
          else groups.push({ label, id: `${slug(city)}.cm`, branches: [b] }); // ".cm": a branch owner can share the city's name (precision.multan)
        }
      } else {
        for (let i = 0; i < inRegion.length; i += 3) groups.push({ label: `${region} Cluster ${String.fromCharCode(65 + i / 3)} Manager`, id: `${slug(region)}.c${String.fromCharCode(97 + i / 3)}`, branches: inRegion.slice(i, i + 3) });
      }
      for (const g of groups) {
        const cMgr = await teamMember(org._id, `${key}.${g.id}@${LOGIN_DOMAIN}`, g.label.endsWith("Manager") ? g.label : `${g.label} Lead`, products);
        await User.updateOne({ _id: cMgr._id }, { $set: { escalatesToUserId: mgr._id } });
        result.people++;
        await Business.updateMany({ _id: { $in: g.branches.map((b) => b._id) } }, { $set: { escalatesToUserId: cMgr._id } });
        result.branchesPointed += g.branches.length;
      }
    }

    if (isPrecision) {
      // A spare cluster manager nobody is assigned to yet: shows a ready replacement when someone leaves.
      const spare = await teamMember(org._id, `precision.spare@${LOGIN_DOMAIN}`, "Cluster Manager (spare)", products);
      await User.updateOne({ _id: spare._id }, { $set: { escalatesToUserId: aboveRegion } });
      result.people++;
    }

    const used = await User.countDocuments({ accountType: "team_member", teamOfType: "parentOrg", parentId: org._id, inviteStatus: { $ne: "invite_expired" } });
    await ParentOrganization.updateOne(
      { _id: org._id },
      {
        $set: {
          "structure.enabled": true,
          "structure.model": "pointers",
          "structure.tiers": [],
          "structure.groupSteps": [],
          "structure.branchTitle": "Branch manager",
          "structure.slaByTier": {},
          escalationSlaHours: org.escalationSlaHours ?? 48,
          teamMemberSeatLimit: used + (isPrecision ? 1 : 2),
        },
      }
    );
    await EscalationChangeLog.create([
      { ownerType: "parentOrg", ownerId: org._id, actorEmail: "OodelCX", actorKind: "admin", action: "import", summary: `Escalation set up with ${org.name} during onboarding.`, createdAt: new Date(Date.now() - 20 * 86400000) },
      { ownerType: "parentOrg", ownerId: org._id, actorEmail: owner.email, actorKind: "group", action: "set_branches", summary: `${branches[0].name} now escalates to ${ops?.email ?? owner.email}.`, createdAt: new Date(Date.now() - 3 * 86400000) },
    ]);
    result.orgsStructured++;
  }
  return result;
}
