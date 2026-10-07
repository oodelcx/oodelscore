import { redirect } from "next/navigation";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { isCustomerViewProduct } from "@/lib/viewProduct";
import { getTooltips } from "@/lib/tooltips";
import GroupInsightsClient from "./insights-client";

export default async function GroupInsightsPage() {
  // Customer Experience pages only — see isCustomerViewProduct.
  const session = await requireParentOrgOwner();
  if (session && !(await isCustomerViewProduct(session.org))) redirect("/group");
  const tooltips = await getTooltips("group-insights");
  return <GroupInsightsClient tooltips={tooltips} />;
}
