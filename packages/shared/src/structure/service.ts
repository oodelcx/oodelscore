import { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { User } from "../models/User";
import { EscalationAssignment } from "../models/EscalationAssignment";
import { EscalationChangeLog } from "../models/EscalationChangeLog";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { CategoryOwnerMapping } from "../models/CategoryOwnerMapping";
import { SupportTicket } from "../models/SupportTicket";
import { getChainForBusiness } from "../escalation/engine";
import { applyChainVotes, convertTreeToPointers } from "../escalation/convert";
import { createInviteUser } from "../auth/createInviteUser";
import { logCaseEvent } from "../cases/eventLog";
import { sendTemplatedEmail } from "../email/resend";
import { buildPointerChain, wouldCreateLoop, idStr, type PointerPerson } from "./chain";

export type StructureOwner = { kind: "parentOrg"; id: string } | { kind: "business"; id: string };

/** Who is making the change, for the change log and for who-may-do-what. Admin-only actions check `kind`. */
export interface StructureActor {
  userId: string | null;
  email: string;
  kind: "group" | "admin";
}

export class StructureError extends Error {}

export type ImportKind = "people" | "branches";
export interface ImportRow {
  [key: string]: string;
}
export interface ImportPreviewRow {
  row: number;
  label: string;
  status: "new" | "update" | "unchanged" | "error";
  message: string;
}

const TEAM_TIERS = ["full", "limited"] as const;
const ISSUE_TEXT: Record<string, string> = {
  nobody_set: "No one set. Cases go straight to the Group Head.",
  pointer_removed: "Points to someone who has left. Cases go to the Group Head.",
  loop: "The chain loops back on itself.",
  too_long: "The chain is too long.",
};

function isTestEmail(email: string) {
  return /\.test$/i.test(email.trim());
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

type Loaded = Awaited<ReturnType<typeof loadOwner>>;
type PersonKind = "head" | "team" | "branch";

interface RawPerson {
  id: string;
  email: string;
  title: string;
  kind: PersonKind;
  tier: "full" | "limited" | null;
  escalatesToId: string | null;
  inviteStatus: string;
  branchId: string | null;
}

/** Everyone who can hold an escalation step in this account, plus the branches in scope. */
async function loadPeople(owner: StructureOwner, loaded: Loaded) {
  const branches =
    owner.kind === "parentOrg"
      ? await Business.find({ parentOrgId: owner.id, active: true }).select("name region escalatesToUserId sensitiveRoutingContactId").sort({ name: 1 })
      : [loaded.business!];
  const branchIds = branches.map((b) => b._id);
  const users = await User.find(
    owner.kind === "parentOrg"
      ? {
          $or: [
            { accountType: "parent_org", parentId: owner.id },
            { accountType: "team_member", teamOfType: "parentOrg", parentId: owner.id },
            { accountType: "business", parentId: { $in: branchIds } },
          ],
        }
      : {
          $or: [
            { accountType: "business", parentId: owner.id },
            { accountType: "team_member", teamOfType: "business", parentId: owner.id },
          ],
        }
  ).select("email accountType teamRole tier parentId escalatesToUserId inviteStatus");
  const branchName = new Map(branches.map((b) => [b._id.toString(), b.name]));
  const people: RawPerson[] = users.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    title: u.teamRole || (u.accountType === "parent_org" ? "Group Head" : u.accountType === "business" ? "Branch manager" : ""),
    kind: u.accountType === "parent_org" ? "head" : u.accountType === "business" ? "branch" : "team",
    tier: u.accountType === "team_member" ? u.tier : null,
    escalatesToId: idStr(u.escalatesToUserId),
    inviteStatus: u.inviteStatus,
    branchId: u.accountType === "business" ? u.parentId?.toString() ?? null : null,
  }));
  return { branches, people, branchName };
}

async function seatsFor(owner: StructureOwner, loaded: Loaded) {
  const limit = (loaded.org ? loaded.org.teamMemberSeatLimit : loaded.business!.teamMemberSeatLimit) ?? null;
  const used = await User.countDocuments({
    accountType: "team_member",
    teamOfType: owner.kind,
    parentId: owner.id,
    inviteStatus: { $ne: "invite_expired" },
  });
  return { used, limit };
}

async function ensurePointers(owner: StructureOwner, loaded: Loaded) {
  const structure = loaded.org ? loaded.org.structure : loaded.business!.structure;
  if (structure?.enabled && structure.model !== "pointers") {
    await convertTreeToPointers(owner.kind === "parentOrg" ? { parentOrgId: owner.id } : { businessId: owner.id });
  }
}

export async function loadStructure(owner: StructureOwner) {
  let loaded = await loadOwner(owner);
  await ensurePointers(owner, loaded);
  loaded = await loadOwner(owner);
  const { org, business } = loaded;
  const structure = org ? org.structure : business!.structure;
  const slaHours = (org ? org.escalationSlaHours : business!.escalationSlaHours) ?? null;
  const { branches, people, branchName } = await loadPeople(owner, loaded);
  const byId = new Map(people.map((p) => [p.id, p]));
  const head = people.find((p) => p.kind === "head") ?? null;

  const pointerPeople = new Map<string, PointerPerson>(people.map((p) => [p.id, { id: p.id, title: p.title, escalatesToId: p.escalatesToId }]));
  const usedBy = new Map<string, number>();
  const branchRows = branches.map((b) => {
    const manager = people.find((p) => p.kind === "branch" && p.branchId === b._id.toString());
    const first = idStr(b.escalatesToUserId);
    const result = buildPointerChain({
      branchTitle: structure?.branchTitle || "Branch manager",
      branchOwnerId: manager?.id ?? null,
      firstPointerId: first,
      people: pointerPeople,
      head: head ? { id: head.id, title: "Group Head" } : null,
    });
    for (const s of result.chain.slice(1)) if (s.userId) usedBy.set(s.userId, (usedBy.get(s.userId) ?? 0) + 1);
    return {
      id: b._id.toString(),
      name: b.name,
      region: b.region ?? "",
      managerEmail: manager?.email ?? "",
      escalatesToId: first,
      chain: result.chain.slice(1).map((s) => ({ label: s.label, email: s.userId ? byId.get(s.userId)?.email ?? "" : "" })),
      issues: result.issues.map((i) => ISSUE_TEXT[i]),
    };
  });

  const openCases = await ActionBoardItem.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { businessId: { $in: branches.map((b) => b._id) }, status: { $ne: "resolved" }, ownerId: { $ne: null } } },
    { $group: { _id: "$ownerId", n: { $sum: 1 } } },
  ]);
  const openByOwner = new Map(openCases.map((r) => [r._id.toString(), r.n]));

  const legacyLevels = (org ? org.escalationLevels : business!.escalationLevels) ?? [];
  const legacyAssignments = org ? await EscalationAssignment.countDocuments({ parentOrgId: org._id }) : await EscalationAssignment.countDocuments({ businessId: business!._id });

  const log = await EscalationChangeLog.find({ ownerType: owner.kind, ownerId: owner.id }).sort({ createdAt: -1 }).limit(20);

  return {
    kind: owner.kind,
    name: org ? org.name : business!.name,
    enabled: !!structure?.enabled,
    model: structure?.enabled && structure.model === "pointers" ? ("pointers" as const) : ("legacy" as const),
    branchTitle: structure?.branchTitle || "Branch manager",
    slaHours,
    head: head ? { id: head.id, email: head.email } : null,
    branches: branchRows,
    people: people
      .filter((p) => p.kind !== "branch")
      .map((p) => ({
        id: p.id,
        email: p.email,
        title: p.title,
        kind: p.kind,
        tier: p.tier,
        escalatesToId: p.kind === "head" ? null : p.escalatesToId,
        inviteStatus: p.inviteStatus,
        usedByBranches: usedBy.get(p.id) ?? 0,
        openCases: openByOwner.get(p.id) ?? 0,
      })),
    /** Every address a branch or person may point to (includes branch managers). */
    targets: people.map((p) => ({ id: p.id, email: p.email, label: p.kind === "branch" ? `${p.email} (${branchName.get(p.branchId ?? "") ?? "branch"})` : p.title ? `${p.email} (${p.title})` : p.email })),
    seats: await seatsFor(owner, loaded),
    legacy: { levels: legacyLevels.map((l) => ({ level: l.level, label: l.label })), assignmentCount: legacyAssignments },
    changeLog: log.map((l) => ({ id: l._id.toString(), at: l.createdAt, by: l.actorEmail || "System", byKind: l.actorKind, summary: l.summary })),
  };
}

/** The chain one branch would follow, with emails, for the preview box. */
export async function previewChain(owner: StructureOwner, businessId: string) {
  const business = owner.kind === "parentOrg" ? await Business.findOne({ _id: businessId, parentOrgId: owner.id }) : await Business.findOne({ _id: owner.id });
  if (!business) throw new StructureError("Branch not found");
  const { chain, mode, slaHours } = await getChainForBusiness(business);
  const users = await User.find({ _id: { $in: chain.map((c) => c.userId).filter((x): x is string => !!x) } }).select("email");
  const emailById = new Map(users.map((u) => [u._id.toString(), u.email]));
  return { mode, slaHours, steps: chain.map((c) => ({ level: c.level, label: c.label, email: c.userId ? emailById.get(c.userId) ?? "" : "", hours: slaHours })) };
}

async function writeLog(owner: StructureOwner, actor: StructureActor, action: string, summary: string) {
  try {
    await EscalationChangeLog.create({
      ownerType: owner.kind,
      ownerId: owner.id,
      actorUserId: actor.userId ? new Types.ObjectId(actor.userId) : null,
      actorEmail: actor.email,
      actorKind: actor.kind,
      action,
      summary,
    });
  } catch (err) {
    console.error("[structure] change log write failed", err);
  }
}

/** Tells the person they are now someone's escalation contact. Never blocks the change; skipped for demo (.test) addresses and people who still have an invite pending. */
async function notifyAssigned(owner: StructureOwner, accountName: string, personId: string, fromWhom: string, actor: StructureActor) {
  try {
    const user = await User.findById(personId).select("email inviteStatus");
    if (!user || user.inviteStatus !== "active" || isTestEmail(user.email)) return;
    await sendTemplatedEmail("escalation_role_assigned", user.email, {
      name: user.email,
      changed_by: actor.kind === "admin" ? "OodelCX" : actor.email,
      from_whom: fromWhom,
      account_name: accountName,
      app_link: process.env.APP_URL ?? "",
    });
  } catch (err) {
    console.error("[structure] role-assigned email failed", err);
  }
}

function cleanTitle(v: unknown) {
  return typeof v === "string" ? v.trim().slice(0, 60) : "";
}

function toObjectId(id: string | null) {
  return id ? new Types.ObjectId(id) : null;
}

function resolveEmail(people: RawPerson[], email: unknown, what: string): RawPerson | null {
  if (typeof email !== "string" || !email.trim()) return null;
  const hit = people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
  if (!hit) throw new StructureError(`${email.trim()} is not on this account's team. Add them as a team member first.`);
  void what;
  return hit;
}

export async function applyStructureAction(owner: StructureOwner, body: Record<string, unknown>, actor: StructureActor): Promise<{ message?: string }> {
  let loaded = await loadOwner(owner);
  await ensurePointers(owner, loaded);
  loaded = await loadOwner(owner);
  const { org, business } = loaded;
  const accountName = org ? org.name : business!.name;
  const action = typeof body.action === "string" ? body.action : "";
  const live = loaded.org ? loaded.org.structure : loaded.business!.structure;
  if (action !== "convertLegacy" && !(live?.enabled && live.model === "pointers")) {
    throw new StructureError("Switch to the new escalation screen first.");
  }

  switch (action) {
    case "setBranches": {
      const { people, branches } = await loadPeople(owner, loaded);
      const target = resolveEmail(people, body.toEmail, "branch");
      const ids = (Array.isArray(body.businessIds) ? (body.businessIds as unknown[]).map(String) : []).filter((id) => branches.some((b) => b._id.toString() === id));
      if (!ids.length) throw new StructureError("Choose at least one branch.");
      for (const id of ids) {
        const manager = people.find((p) => p.kind === "branch" && p.branchId === id);
        if (target && manager && manager.id === target.id) throw new StructureError("A branch cannot escalate to its own manager.");
      }
      await Business.updateMany({ _id: { $in: ids } }, { $set: { escalatesToUserId: toObjectId(target?.id ?? null) } });
      const names = branches.filter((b) => ids.includes(b._id.toString())).map((b) => b.name);
      const label = names.length === 1 ? names[0] : `${names[0]} and ${names.length - 1} other branch${names.length === 2 ? "" : "es"}`;
      await writeLog(owner, actor, "set_branches", target ? `${label} now escalate to ${target.email}.` : `${label} now go straight to the Group Head.`);
      if (target) await notifyAssigned(owner, accountName, target.id, label, actor);
      return {};
    }

    case "setPerson": {
      const { people } = await loadPeople(owner, loaded);
      const person = people.find((p) => p.id === String(body.personId));
      if (!person) throw new StructureError("Person not found");
      if (person.kind === "head") throw new StructureError("The Group Head is the top of the chain and escalates to no one.");
      const target = resolveEmail(people, body.toEmail, "person");
      if (target) {
        if (target.id === person.id) throw new StructureError("A person cannot escalate to themselves.");
        const pointers = new Map(people.map((p) => [p.id, p.escalatesToId]));
        if (wouldCreateLoop(person.id, target.id, pointers)) throw new StructureError(`That would loop: ${target.email} already escalates up to ${person.email}.`);
      }
      await User.updateOne({ _id: person.id }, { $set: { escalatesToUserId: toObjectId(target?.id ?? null) } });
      await writeLog(owner, actor, "set_person", target ? `${person.email} now escalates to ${target.email}.` : `${person.email} is now the top of their chain.`);
      if (target) await notifyAssigned(owner, accountName, target.id, person.email, actor);
      return {};
    }

    case "setSla": {
      let hours: number | null = null;
      if (typeof body.hours === "number" && body.hours > 0 && body.hours <= 24 * 90) hours = Math.round(body.hours);
      else if (body.hours !== null) throw new StructureError("Enter a number of hours between 1 and 2160, or leave it blank for none.");
      if (org) await ParentOrganization.updateOne({ _id: org._id }, { $set: { escalationSlaHours: hours } });
      else await Business.updateOne({ _id: business!._id }, { $set: { escalationSlaHours: hours } });
      await writeLog(owner, actor, "set_sla", hours ? `Time at each step set to ${hours} hours.` : "Automatic escalation turned off.");
      return {};
    }

    case "setBranchTitle": {
      const title = cleanTitle(body.title);
      if (!title) throw new StructureError("Enter a title.");
      if (org) await ParentOrganization.updateOne({ _id: org._id }, { $set: { "structure.branchTitle": title } });
      else await Business.updateOne({ _id: business!._id }, { $set: { "structure.branchTitle": title } });
      return {};
    }

    case "addPerson": {
      const created = await createPerson(owner, loaded, actor, {
        email: body.email,
        title: body.title,
        tier: body.tier,
      });
      if (typeof body.escalatesToEmail === "string" && body.escalatesToEmail.trim()) {
        const { people } = await loadPeople(owner, loaded);
        const target = resolveEmail(people, body.escalatesToEmail, "person");
        if (target && target.id !== created.id) await User.updateOne({ _id: created.id }, { $set: { escalatesToUserId: toObjectId(target.id) } });
      }
      return { message: `Invitation sent to ${created.email}.` };
    }

    case "removePerson": {
      return removePerson(owner, loaded, actor, body);
    }

    case "requestSeats": {
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
      const seats = await seatsFor(owner, loaded);
      await createSeatRequest(owner, accountName, actor, seats, note);
      await writeLog(owner, actor, "request_seats", "Asked OodelCX for more team seats.");
      return { message: "Request sent. Your OodelCX account manager will be in touch." };
    }

    case "convertLegacy": {
      const result = await convertLegacyToPointers(owner, loaded);
      await writeLog(owner, actor, "convert", `Moved the earlier setup to the new "escalates to" screen${result.skippedBranchOverrides ? ` (${result.skippedBranchOverrides} branch-specific overrides were not carried over)` : ""}.`);
      return { message: "Moved to the new screen." };
    }

    default:
      throw new StructureError("Unknown action");
  }
}

async function createPerson(
  owner: StructureOwner,
  loaded: Loaded,
  actor: StructureActor,
  input: { email: unknown; title: unknown; tier: unknown },
  opts: { skipSeatCheck?: boolean; excludeFromCount?: number } = {}
) {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StructureError("Enter a valid email address.");
  const title = cleanTitle(input.title);
  if (!title) throw new StructureError("Enter their title (for example Regional Manager).");
  const tier = input.tier === "limited" ? "limited" : "full";
  if (await User.exists({ email })) throw new StructureError(`${email} already has an OodelCX login. Use a different email.`);
  if (!opts.skipSeatCheck) {
    const seats = await seatsFor(owner, loaded);
    const used = seats.used - (opts.excludeFromCount ?? 0);
    if (seats.limit !== null && used >= seats.limit) {
      throw new StructureError(`No team seats left (${seats.used} of ${seats.limit} used). Ask OodelCX for more seats, or remove someone first.`);
    }
  }
  const name = loaded.org ? loaded.org.name : loaded.business!.name;
  const user = await createInviteUser({
    email,
    accountType: "team_member",
    parentId: loaded.org ? loaded.org._id : loaded.business!._id,
    teamRole: title,
    tier,
    teamOfType: owner.kind,
    inviterName: actor.kind === "admin" ? "OodelCX" : actor.email,
    businessOrOrgName: name,
    appUrl: process.env.APP_URL ?? "",
  });
  await writeLog(owner, actor, "add_person", `Added ${email} as ${title}.`);
  return user;
}

async function removePerson(owner: StructureOwner, loaded: Loaded, actor: StructureActor, body: Record<string, unknown>): Promise<{ message?: string }> {
  const accountName = loaded.org ? loaded.org.name : loaded.business!.name;
  const { people, branches } = await loadPeople(owner, loaded);
  const person = people.find((p) => p.id === String(body.personId));
  if (!person) throw new StructureError("Person not found");
  if (actor.userId && person.id === actor.userId) throw new StructureError("You cannot remove your own login here.");
  if (person.kind !== "team") throw new StructureError("Only team members can be removed here. The Group Head and branch managers are managed by OodelCX.");

  const replacementInput = body.newPerson && typeof body.newPerson === "object" ? (body.newPerson as Record<string, unknown>) : null;
  let replacement: { id: string; email: string } | null = null;
  if (replacementInput) {
    // Validate and seat-check before deleting anyone; the leaver's seat is freed by the swap.
    const email = typeof replacementInput.email === "string" ? replacementInput.email.trim().toLowerCase() : "";
    if (email === person.email.toLowerCase()) throw new StructureError("Enter the replacement's email, not the person leaving.");
    const user = await createPerson(owner, loaded, actor, { email, title: replacementInput.title || person.title, tier: replacementInput.tier ?? person.tier }, { excludeFromCount: 1 });
    replacement = { id: user._id.toString(), email: user.email };
  } else if (typeof body.replacementId === "string" && body.replacementId) {
    const hit = people.find((p) => p.id === body.replacementId);
    if (!hit || hit.id === person.id) throw new StructureError("Choose someone else to take over.");
    replacement = { id: hit.id, email: hit.email };
  }

  // Where things go if nobody takes over: whoever the leaver escalated to, else the Group Head.
  const head = people.find((p) => p.kind === "head") ?? null;
  const fallbackId = replacement?.id ?? person.escalatesToId ?? head?.id ?? null;
  const fallback = fallbackId ? people.find((p) => p.id === fallbackId) ?? (replacement && fallbackId === replacement.id ? { id: replacement.id, email: replacement.email } : null) : null;
  const pid = new Types.ObjectId(person.id);

  // A replacement inherits the leaver's own pointer so the chain above them is unchanged.
  if (replacement) {
    const upward = person.escalatesToId && person.escalatesToId !== replacement.id ? person.escalatesToId : null;
    await User.updateOne({ _id: replacement.id }, { $set: { escalatesToUserId: toObjectId(upward) } });
  }
  const newTarget = fallback ? new Types.ObjectId(fallback.id) : null;

  // Everyone pointing at the leaver now points at the replacement (or past the leaver). A pointer must never become a self-loop.
  const pointingPeople = await User.find({ escalatesToUserId: pid }).select("_id");
  for (const u of pointingPeople) {
    const self = newTarget && u._id.equals(newTarget);
    await User.updateOne({ _id: u._id }, { $set: { escalatesToUserId: self ? null : newTarget } });
  }
  await Business.updateMany({ escalatesToUserId: pid }, { $set: { escalatesToUserId: newTarget } });

  // Open cases the leaver held move with the role, and each move is written to the case timeline.
  const branchIds = branches.map((b) => b._id);
  const cases = await ActionBoardItem.find({ businessId: { $in: branchIds }, ownerId: pid, status: { $ne: "resolved" } });
  for (const item of cases) {
    item.ownerId = newTarget;
    await item.save();
    await logCaseEvent({
      actionBoardItemId: item._id,
      businessId: item.businessId,
      kind: "owner_changed",
      fromValue: person.email,
      toValue: fallback?.email ?? null,
      actorUserId: actor.userId ? new Types.ObjectId(actor.userId) : null,
      actorLabel: actor.kind === "admin" ? "OodelCX" : actor.email,
      note: `${person.email} left the escalation team; the case moved to ${fallback?.email ?? "no one"}.`,
    });
  }

  if (newTarget) {
    await CategoryOwnerMapping.updateMany({ defaultOwnerId: pid }, { $set: { defaultOwnerId: newTarget } });
    await EscalationAssignment.updateMany({ userId: pid }, { $set: { userId: newTarget } });
    await Business.updateMany({ sensitiveRoutingContactId: pid }, { $set: { sensitiveRoutingContactId: newTarget } });
    if (loaded.org) await ParentOrganization.updateMany({ sensitiveRoutingContactId: pid }, { $set: { sensitiveRoutingContactId: newTarget } });
  } else {
    await CategoryOwnerMapping.deleteMany({ defaultOwnerId: pid });
    await EscalationAssignment.deleteMany({ userId: pid });
  }

  await User.deleteOne({ _id: pid });
  await writeLog(
    owner,
    actor,
    "remove_person",
    replacement ? `${person.email} left; ${replacement.email} took over their role and ${cases.length} open case${cases.length === 1 ? "" : "s"}.` : `${person.email} was removed${fallback ? `; their branches, team and ${cases.length} open case${cases.length === 1 ? "" : "s"} moved to ${fallback.email}` : ""}.`
  );
  if (replacement) await notifyAssigned(owner, accountName, replacement.id, person.title || "the people who reported to the previous role", actor);
  return { message: replacement ? `${replacement.email} has been invited and has taken over.` : `${person.email} was removed.` };
}

async function createSeatRequest(owner: StructureOwner, accountName: string, actor: StructureActor, seats: { used: number; limit: number | null }, note: string) {
  const subject = `More team seats needed for ${accountName}`;
  const body = `${actor.email} asked for more team seats. Currently ${seats.used} of ${seats.limit ?? "unlimited"} used.${note ? `\n\nNote: ${note}` : ""}`;
  await SupportTicket.create({
    ownerType: owner.kind,
    ownerId: new Types.ObjectId(owner.id),
    ownerName: accountName,
    submittedByUserId: actor.userId ? new Types.ObjectId(actor.userId) : null,
    submittedByEmail: actor.email,
    category: "access",
    subject,
    body,
  });
  const notifyTo = process.env.SUPPORT_QUEUE_NOTIFY_EMAIL ?? process.env.CONTACT_FORM_NOTIFY_EMAIL ?? "hello@oodelscore.com";
  const appUrl = process.env.APP_URL ?? "";
  await sendTemplatedEmail("support_ticket_created", notifyTo, {
    account_name: accountName,
    submitter_email: actor.email,
    category: "access",
    subject,
    body,
    ticket_link: appUrl ? `${appUrl}/admin/support-queue` : "/admin/support-queue",
  }).catch((err) => console.error("[structure] seat request email failed", err));
}

/** Moves a group still on the numbered levels onto "escalates to" pointers, using each branch's current chain. */
async function convertLegacyToPointers(owner: StructureOwner, loaded: Loaded): Promise<{ skippedBranchOverrides: number }> {
  const { org, business } = loaded;
  const targets = org ? await Business.find({ parentOrgId: org._id, active: true }) : [business!];
  const chains = [];
  for (const b of targets) {
    const { chain } = await getChainForBusiness(b);
    chains.push({
      businessId: b._id,
      people: chain
        .slice(1)
        .filter((s): s is typeof s & { userId: string } => !!s.userId)
        .map((s) => ({ userId: s.userId, title: s.label })),
    });
  }
  // The head is always the top of the chain: never given a pointer.
  await applyChainVotes(chains);
  if (org) {
    const head = await User.findOne({ accountType: "parent_org", parentId: org._id }).select("_id");
    if (head) await User.updateOne({ _id: head._id }, { $set: { escalatesToUserId: null } });
    await ParentOrganization.updateOne({ _id: org._id }, { $set: { "structure.enabled": true, "structure.model": "pointers" } });
  } else {
    await Business.updateOne({ _id: business!._id }, { $set: { "structure.enabled": true, "structure.model": "pointers" } });
  }
  const assignments = org ? await EscalationAssignment.find({ parentOrgId: org._id }) : await EscalationAssignment.find({ businessId: business!._id });
  return { skippedBranchOverrides: assignments.filter((a) => a.parentOrgId && a.businessId).length };
}

// ---------------------------------------------------------------------------
// Bulk import (OodelCX Admin only): paste or upload a CSV, review it, apply it.
// ---------------------------------------------------------------------------

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : "");

interface PlannedPerson {
  email: string;
  title: string;
  tier: "full" | "limited";
  escalatesToEmail: string;
  exists: boolean;
}

async function planImport(owner: StructureOwner, loaded: Loaded, kind: ImportKind, rows: ImportRow[]) {
  const { people, branches } = await loadPeople(owner, loaded);
  const seats = await seatsFor(owner, loaded);
  const preview: ImportPreviewRow[] = [];
  const peoplePlan: PlannedPerson[] = [];
  const branchPlan: { branchId: string; toEmail: string }[] = [];
  const knownEmails = new Set(people.map((p) => p.email.toLowerCase()));
  const importedEmails = new Set<string>();
  if (rows.length > 500) throw new StructureError("Import up to 500 rows at a time.");

  if (kind === "people") {
    for (const r of rows) importedEmails.add(norm(r.email).toLowerCase());
    let newCount = 0;
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      const email = norm(r.email).toLowerCase();
      const title = norm(r.title);
      const tier = norm(r.access).toLowerCase() === "limited" ? "limited" : "full";
      const up = norm(r.escalates_to_email).toLowerCase();
      const rowNo = i + 1;
      const fail = (message: string) => preview.push({ row: rowNo, label: email || `Row ${rowNo}`, status: "error", message });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Not a valid email address.");
      if (seen.has(email)) return fail("This email appears twice in the file.");
      seen.add(email);
      if (up && up === email) return fail("A person cannot escalate to themselves.");
      if (up && !knownEmails.has(up) && !importedEmails.has(up)) return fail(`Escalates to ${up}, who is not on this account or in this file.`);
      const existing = people.find((p) => p.email.toLowerCase() === email);
      if (existing && existing.kind !== "team") return fail(existing.kind === "head" ? "This is the Group Head. Their title and position are fixed." : "This is a branch manager. Set their branch's escalation on the branches file instead.");
      if (!existing) {
        if (!title) return fail("Title is required for a new person.");
        newCount++;
        peoplePlan.push({ email, title, tier, escalatesToEmail: up, exists: false });
        preview.push({ row: rowNo, label: email, status: "new", message: `Will be invited as ${title}${up ? `, escalating to ${up}` : ""}.` });
      } else {
        peoplePlan.push({ email, title: title || existing.title, tier: existing.tier ?? "full", escalatesToEmail: up, exists: true });
        preview.push({ row: rowNo, label: email, status: "update", message: `Existing person${title && title !== existing.title ? `, title becomes ${title}` : ""}${up ? `, escalating to ${up}` : ", escalation unchanged"}.` });
      }
    });
    if (seats.limit !== null && seats.used + newCount > seats.limit) {
      preview.unshift({ row: 0, label: "Team seats", status: "error", message: `This file adds ${newCount} new people but only ${Math.max(0, seats.limit - seats.used)} seat${seats.limit - seats.used === 1 ? "" : "s"} are free (${seats.used} of ${seats.limit} used). Raise the seat limit first.` });
    }
    // Loops among the planned pointers.
    const pointers = new Map<string, string | null>(people.map((p) => [p.email.toLowerCase(), p.escalatesToId ? people.find((q) => q.id === p.escalatesToId)?.email.toLowerCase() ?? null : null]));
    for (const p of peoplePlan) if (p.escalatesToEmail) pointers.set(p.email, p.escalatesToEmail);
    for (const p of peoplePlan) {
      if (!p.escalatesToEmail) continue;
      if (wouldCreateLoop(p.email, p.escalatesToEmail, pointers)) {
        const row = preview.find((x) => x.label === p.email);
        if (row) {
          row.status = "error";
          row.message = `Escalating to ${p.escalatesToEmail} would loop back to this person.`;
        }
      }
    }
  } else {
    rows.forEach((r, i) => {
      const rowNo = i + 1;
      const name = norm(r.branch);
      const up = norm(r.escalates_to_email).toLowerCase();
      const branch = branches.find((b) => b.name.toLowerCase() === name.toLowerCase());
      const fail = (message: string) => preview.push({ row: rowNo, label: name || `Row ${rowNo}`, status: "error", message });
      if (!name) return fail("Branch name is required.");
      if (!branch) return fail(`No branch named "${name}" on this account.`);
      if (up && !knownEmails.has(up)) return fail(`${up} is not on this account's team. Import people first.`);
      const manager = people.find((p) => p.kind === "branch" && p.branchId === branch._id.toString());
      if (up && manager && manager.email.toLowerCase() === up) return fail("A branch cannot escalate to its own manager.");
      const current = idStr(branch.escalatesToUserId);
      const currentEmail = current ? people.find((p) => p.id === current)?.email.toLowerCase() ?? "" : "";
      branchPlan.push({ branchId: branch._id.toString(), toEmail: up });
      preview.push({ row: rowNo, label: branch.name, status: currentEmail === up ? "unchanged" : "update", message: up ? `Escalates to ${up}.` : "Goes straight to the Group Head." });
    });
  }
  return { preview, peoplePlan, branchPlan, hasErrors: preview.some((p) => p.status === "error") };
}

export async function previewImport(owner: StructureOwner, actor: StructureActor, kind: ImportKind, rows: ImportRow[]) {
  if (actor.kind !== "admin") throw new StructureError("Only OodelCX can import in bulk.");
  const loaded = await loadOwner(owner);
  await ensurePointers(owner, loaded);
  const { preview, hasErrors } = await planImport(owner, loaded, kind, rows);
  return { preview, hasErrors };
}

export async function applyImport(owner: StructureOwner, actor: StructureActor, kind: ImportKind, rows: ImportRow[]): Promise<{ message: string }> {
  if (actor.kind !== "admin") throw new StructureError("Only OodelCX can import in bulk.");
  const loaded = await loadOwner(owner);
  await ensurePointers(owner, loaded);
  const plan = await planImport(owner, loaded, kind, rows);
  if (plan.hasErrors) throw new StructureError("Fix the rows marked in red first. Nothing was imported.");

  if (kind === "people") {
    for (const p of plan.peoplePlan) {
      if (p.exists) {
        await User.updateOne({ email: p.email }, { $set: { teamRole: p.title } });
      } else {
        await createPerson(owner, loaded, actor, { email: p.email, title: p.title, tier: p.tier }, { skipSeatCheck: true });
      }
    }
    for (const p of plan.peoplePlan) {
      if (!p.escalatesToEmail) continue;
      const to = await User.findOne({ email: p.escalatesToEmail }).select("_id");
      if (to) await User.updateOne({ email: p.email }, { $set: { escalatesToUserId: to._id } });
    }
    await writeLog(owner, actor, "import", `Imported ${plan.peoplePlan.length} people from a file.`);
    return { message: `Imported ${plan.peoplePlan.length} people.` };
  }

  for (const b of plan.branchPlan) {
    const to = b.toEmail ? await User.findOne({ email: b.toEmail }).select("_id") : null;
    await Business.updateOne({ _id: b.branchId }, { $set: { escalatesToUserId: to ? to._id : null } });
  }
  await writeLog(owner, actor, "import", `Set escalation for ${plan.branchPlan.length} branches from a file.`);
  return { message: `Updated ${plan.branchPlan.length} branches.` };
}
