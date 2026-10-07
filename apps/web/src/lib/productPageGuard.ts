import { redirect } from "next/navigation";
import { hasProduct } from "@oodelscore/shared";
import { requireBusinessOwner, requireParentOrgOwner } from "@/lib/ownerAuth";

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
  if (!ok) redirect(portal === "business" ? "/business" : "/group");
}
