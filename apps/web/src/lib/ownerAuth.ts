import {
  Business,
  ParentOrganization,
  teamMemberCanAccess,
  branchPermissionAllowed,
  type CaseViewer,
  type IBusiness,
  type IParentOrganization,
  type TeamMemberTier,
  type TeamPageKey,
  type BranchDelegatablePermission,
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
 * Whether a business session may act on its own in one of the areas a
 * parent org can choose to delegate down (Feedback Points viewing/requests,
 * Category Owners overrides, CX Goals, Alert Rules) — false for a branch
 * whose org has kept that area centralized. Always true for a standalone
 * business or the actual top account of a group, which is who'd be doing
 * the delegating in the first place.
 */
export async function checkBranchPermission(
  business: HydratedDocument<IBusiness>,
  permission: BranchDelegatablePermission
): Promise<boolean> {
  if (!business.parentOrgId) return true;
  const org = await ParentOrganization.findById(business.parentOrgId).select("branchPermissions");
  return branchPermissionAllowed(true, org?.branchPermissions, permission);
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

/** Who a business-portal session is, for Sensitive-case visibility (see canViewCase). */
export function caseViewerForBusiness(session: BusinessOwnerSession): CaseViewer {
  return {
    userId: session.user._id.toString(),
    // A branch never sees an unassigned sensitive case; a standalone business's own owner login does.
    seesUnassignedSensitive: !session.isTeamMember && !session.business.parentOrgId,
  };
}

/** Same, for a group-portal session: only the group's top owner login sees an unassigned one. */
export function caseViewerForGroup(session: ParentOrgOwnerSession): CaseViewer {
  return { userId: session.user._id.toString(), seesUnassignedSensitive: !session.isTeamMember };
}
