import { redirect } from "next/navigation";
import { hasProduct, teamMemberCanAccess, type TeamPageKey, type BranchDelegatablePermission } from "@oodelscore/shared";
import { requireBusinessOwner, requireParentOrgOwner, checkBranchPermission } from "@/lib/ownerAuth";

type Need = "colleague" | "both";

/**
 * Server-side guard for pages that only make sense when the account has a
 * product (Colleague Experience, or both). Without it, typing the address of
 * such a page shows an empty screen whose forms can only fail. A signed-out
 * visitor is left to the layout, which already sends them to log in.
 */
export async function redirectUnlessProduct(portal: "business" | "group", need: Need): Promise<void> {
  const entity = portal === "business" ? (await requireBusinessOwner({ allowLimitedTeamMember: true }))?.business : (await requireParentOrgOwner({ allowLimitedTeamMember: true }))?.org;
  if (!entity) return;
  const ok = need === "colleague" ? hasProduct(entity, "colleague_experience") : hasProduct(entity, "colleague_experience") && hasProduct(entity, "customer_experience");
  // A branch has no CX↔EX page of its own (the group compares across locations).
  const branchWithoutPage = portal === "business" && need === "both" && !!(entity as { parentOrgId?: unknown }).parentOrgId;
  if (!ok || branchWithoutPage) redirect(portal === "business" ? "/business" : "/group");
}

/**
 * Server-side guard for a page a team member can be restricted from (Admin's
 * per-person access grid) or a branch's group has kept centralized. The nav
 * hides these, but typing the address must not show the screen either.
 * `branchKey` is the delegatable permission that also gates the page for a branch.
 */
export async function redirectUnlessPage(
  portal: "business" | "group",
  page: TeamPageKey,
  branchKey?: BranchDelegatablePermission
): Promise<void> {
  const session = portal === "business" ? await requireBusinessOwner({ allowLimitedTeamMember: true }) : await requireParentOrgOwner({ allowLimitedTeamMember: true });
  if (!session) return;
  if (session.isTeamMember && !teamMemberCanAccess(session.user, page)) redirect(portal === "business" ? "/business" : "/group");
  if (portal === "business" && branchKey && "business" in session) {
    if (!(await checkBranchPermission(session.business, branchKey))) redirect("/business");
  }
}
