import { getTooltips } from "@/lib/tooltips";
import GroupBillingClient from "./billing-client";

export default async function GroupBillingPage() {
  const tooltips = await getTooltips("group-billing");
  return <GroupBillingClient tooltips={tooltips} />;
}
