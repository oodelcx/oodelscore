import type { IRole, IRolePermissions } from "../models/Role";
import type { AccountType } from "../models/User";
import { BUSINESS_ADMIN_ONLY_FIELDS } from "../models/Business";

type StaffPermissionArea = keyof IRolePermissions;
type PermissionAction = "view" | "edit" | "delete";

/**
 * Server-side permission check for admin_staff accounts, driven entirely by
 * their `roles.permissions` document (spec Section 4). Group/Business
 * accounts don't have a `roles` doc — they use the implicit "owner" rules
 * described in the matrix, which get enforced closer to each resource
 * (e.g. `assertNoBusinessAdminOnlyFieldWrites` below), not through this
 * function.
 */
export function hasStaffPermission(role: IRole, area: StaffPermissionArea, action: PermissionAction): boolean {
  return role.permissions[area][action];
}

export class ForbiddenFieldWriteError extends Error {
  constructor(public readonly fields: string[]) {
    super(`Not permitted to write field(s): ${fields.join(", ")}`);
    this.name = "ForbiddenFieldWriteError";
  }
}

/**
 * Enforces spec Section 2/4's rule: `billingAssignment`, `demographicConfig`,
 * and `questionTemplateId` on a `businesses` doc are writable only by
 * accountType "admin_staff". Call this against the raw request body in every
 * Business write route (Group/Business-level PATCH included) *before*
 * applying the update — never trust client-side hiding of these fields.
 *
 * Throws ForbiddenFieldWriteError if a non-admin request body touches any of
 * them, even if the value matches what's already stored.
 */
export function assertNoBusinessAdminOnlyFieldWrites(
  accountType: AccountType,
  body: Record<string, unknown>
): void {
  if (accountType === "admin_staff") return;
  const offending = BUSINESS_ADMIN_ONLY_FIELDS.filter((field) => field in body);
  if (offending.length > 0) {
    throw new ForbiddenFieldWriteError(offending);
  }
}
