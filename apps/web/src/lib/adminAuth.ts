import { Role, type IRole } from "@oodelscore/shared";
import { getCurrentUser } from "./session";
import type { HydratedDocument, Types } from "mongoose";
import type { IUser } from "@oodelscore/shared";

export interface StaffSession {
  user: HydratedDocument<IUser>;
  role: IRole & { _id: Types.ObjectId };
}

/**
 * Resolves the current request to an authenticated admin_staff user plus
 * their role doc, or null if unauthenticated, not staff, or (unexpectedly)
 * missing a role. Every /api/admin/* route should start with this and
 * return 401/403 immediately on null — see each route for the specific
 * hasStaffPermission/canAccessScopedResource check it applies.
 */
export async function requireStaffSession(): Promise<StaffSession | null> {
  const user = await getCurrentUser();
  if (!user || user.accountType !== "admin_staff" || !user.roleId) return null;

  const role = await Role.findById(user.roleId);
  if (!role) return null;

  return { user, role: role as IRole & { _id: Types.ObjectId } };
}
