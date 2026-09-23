import {
  Business,
  ParentOrganization,
  teamMemberCanAccess,
  type IBusiness,
  type IParentOrganization,
  type TeamMemberTier,
  type TeamPageKey,
} from "@oodelscore/shared";
import { getCurrentUser } from "./session";
import type { HydratedDocument } from "mongoose";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export interface BusinessOwnerSession {
  user: CurrentUser;
  business: HydratedDocument<IBusiness>;
  isTeamMember: boolean;
  tier: TeamMemberTier | null;
}

export interface ParentOrgOwnerSession {
  user: CurrentUser;
  org: HydratedDocument<IParentOrganization>;
  isTeamMember: boolean;
  tier: TeamMemberTier | null;
}

interface OwnerAuthOptions {
  // A "limited" tier Team Member only ever sees their own assigned Action
  // Board items (spec Section 16) — every other business/group route must
  // reject them by default, so callers opt IN to allowing it rather than
  // opting out, keeping the safe behavior automatic for routes nobody
  // remembers to update.
  allowLimitedTeamMember?: boolean;
  // Which page this route serves — checked against the team member's own
  // restrictedPages (see features/teamPermissions.ts) so Admin's per-person
  // access grid is actually enforced server-side, not just in the nav.
  // Irrelevant for the primary owner, who always passes.
  requirePage?: TeamPageKey;
}

/**
 * Resolves the current session to a "business" accountType user (the
 * primary owner) or a "full"/"limited" tier "team_member" whose
 * teamOfType is "business", plus the Business doc they act on. Per spec
 * Section 4/16, a Business owner or team member only ever acts on this one
 * record — there is no "assigned" or "all" scope for these account types.
 */
export async function requireBusinessOwner(options: OwnerAuthOptions = {}): Promise<BusinessOwnerSession | null> {
  const user = await getCurrentUser();
  if (!user || !user.parentId) return null;

  if (user.accountType === "business") {
    const business = await Business.findById(user.parentId);
    if (!business) return null;
    return { user, business, isTeamMember: false, tier: null };
  }

  if (user.accountType === "team_member" && user.teamOfType === "business") {
    if (user.tier === "limited" && !options.allowLimitedTeamMember) return null;
    if (options.requirePage && !teamMemberCanAccess(user, options.requirePage)) return null;
    const business = await Business.findById(user.parentId);
    if (!business) return null;
    return { user, business, isTeamMember: true, tier: user.tier };
  }

  return null;
}

/**
 * Resolves the current session to a "parent_org" accountType user (the
 * primary owner) or a "full"/"limited" tier "team_member" whose
 * teamOfType is "parentOrg", plus the ParentOrganization doc. Per spec
 * Section 4, a Group owner acts on their own org plus every child business
 * under it.
 */
export async function requireParentOrgOwner(options: OwnerAuthOptions = {}): Promise<ParentOrgOwnerSession | null> {
  const user = await getCurrentUser();
  if (!user || !user.parentId) return null;

  if (user.accountType === "parent_org") {
    const org = await ParentOrganization.findById(user.parentId);
    if (!org) return null;
    return { user, org, isTeamMember: false, tier: null };
  }

  if (user.accountType === "team_member" && user.teamOfType === "parentOrg") {
    if (user.tier === "limited" && !options.allowLimitedTeamMember) return null;
    if (options.requirePage && !teamMemberCanAccess(user, options.requirePage)) return null;
    const org = await ParentOrganization.findById(user.parentId);
    if (!org) return null;
    return { user, org, isTeamMember: true, tier: user.tier };
  }

  return null;
}
