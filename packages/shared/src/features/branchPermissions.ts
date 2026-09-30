import type { BranchDelegatablePermission, IBranchPermissions } from "../models/ParentOrganization";

/**
 * Whether a business may act on its own for one of the delegatable areas
 * (Feedback Points, Category Owners, CX Goals, Alert Rules). The top
 * account (not a branch) always may — it's the one who'd be delegating.
 * A branch may only when its parent org's branchPermissions says so;
 * missing/undefined branchPermissions (a pre-migration org record) defaults
 * to true, matching the schema default, so no existing branch loses access
 * the moment this ships.
 */
export function branchPermissionAllowed(
  isBranch: boolean,
  orgBranchPermissions: IBranchPermissions | undefined | null,
  permission: BranchDelegatablePermission
): boolean {
  if (!isBranch) return true;
  return orgBranchPermissions?.[permission] ?? true;
}
