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

/**
 * Resolves a scoped area's scope ("all" vs "assigned") and, for "assigned",
 * checks the resource's accountManagerId against the current staff user.
 * Used for businesses/parentOrgs/aiInsightsQueue, the three scoped areas in
 * the permission matrix (spec Section 4).
 */
export function canAccessScopedResource(
  role: IRole,
  area: "businesses" | "parentOrgs" | "aiInsightsQueue",
  action: PermissionAction,
  resourceAccountManagerId: string | null,
  staffUserId: string
): boolean {
  const permission = role.permissions[area];
  if (!permission[action]) return false;
  if (permission.scope === "all") return true;
  return resourceAccountManagerId !== null && resourceAccountManagerId === staffUserId;
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

/**
 * Finer-grained version of the same rule for admin_staff callers
 * specifically (spec Section 4's matrix distinguishes Admin from Account
 * manager/Finance even within staff):
 *
 * - `billingAssignment` has no dedicated permission key in `roles.permissions`
 *   (it's distinct from `billingOversight`, which governs Stripe-level MRR/
 *   invoices, not who's assigned to pay) — restrict it to the system Admin
 *   role specifically, per the matrix's "Admin: edit / everyone else: —".
 * - `demographicConfig`/`questionTemplateId` map directly onto the
 *   `questionTemplates` permission ("Question template & demographic
 *   config" row), so gate those on `questionTemplates.edit`.
 *
 * Call this in every admin Business write route, on top of
 * `assertNoBusinessAdminOnlyFieldWrites` (which only distinguishes
 * admin_staff from Group/Business callers, not staff roles from each other).
 */
export function assertStaffCanEditBusinessAdminFields(role: IRole, body: Record<string, unknown>): void {
  if ("billingAssignment" in body && !(role.isSystemRole && role.name === "Admin")) {
    throw new ForbiddenFieldWriteError(["billingAssignment"]);
  }
  if ("ragThresholds" in body && !(role.isSystemRole && role.name === "Admin")) {
    throw new ForbiddenFieldWriteError(["ragThresholds"]);
  }
  const questionTemplateFields = (["demographicConfig", "questionTemplateId"] as const).filter((f) => f in body);
  if (questionTemplateFields.length > 0 && !hasStaffPermission(role, "questionTemplates", "edit")) {
    throw new ForbiddenFieldWriteError(questionTemplateFields);
  }
}
