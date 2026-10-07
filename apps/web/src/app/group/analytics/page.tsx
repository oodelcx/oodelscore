import { redirect } from "next/navigation";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { isCustomerViewProduct } from "@/lib/viewProduct";
import { getTooltips } from "@/lib/tooltips";
import GroupAnalyticsClient from "./analytics-client";

export default async function GroupAnalyticsPage() {
  // Customer Experience pages only — see isCustomerViewProduct.
  const session = await requireParentOrgOwner();
  if (session && !(await isCustomerViewProduct(session.org))) redirect("/group");
  const tooltips = await getTooltips("group-analytics");
  return <GroupAnalyticsClient tooltips={tooltips} />;
}
