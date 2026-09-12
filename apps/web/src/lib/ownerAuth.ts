import { Business, ParentOrganization, type IBusiness, type IParentOrganization } from "@oodelscore/shared";
import { getCurrentUser } from "./session";
import type { HydratedDocument } from "mongoose";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export interface BusinessOwnerSession {
  user: CurrentUser;
  business: HydratedDocument<IBusiness>;
}

export interface ParentOrgOwnerSession {
  user: CurrentUser;
  org: HydratedDocument<IParentOrganization>;
}

/**
 * Resolves the current session to a "business" accountType user plus their
 * own Business doc (users.parentId -> businesses._id), or null. Per spec
 * Section 4, a Business owner only ever acts on this one record — there is
 * no "assigned" or "all" scope for this account type.
 */
export async function requireBusinessOwner(): Promise<BusinessOwnerSession | null> {
  const user = await getCurrentUser();
  if (!user || user.accountType !== "business" || !user.parentId) return null;

  const business = await Business.findById(user.parentId);
  if (!business) return null;

  return { user, business };
}

/**
 * Resolves the current session to a "parent_org" accountType user plus
 * their own ParentOrganization doc. Per spec Section 4, a Group owner acts
 * on their own org plus every child business under it.
 */
export async function requireParentOrgOwner(): Promise<ParentOrgOwnerSession | null> {
  const user = await getCurrentUser();
  if (!user || user.accountType !== "parent_org" || !user.parentId) return null;

  const org = await ParentOrganization.findById(user.parentId);
  if (!org) return null;

  return { user, org };
}
