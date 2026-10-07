import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { isCustomerViewProduct } from "@/lib/viewProduct";
import { getTooltips } from "@/lib/tooltips";
import AnalyticsClient from "./analytics-client";

export default async function AnalyticsPage() {
  // Customer Experience pages only — see isCustomerViewProduct.
  const session = await requireBusinessOwner();
  if (session && !(await isCustomerViewProduct(session.business))) redirect("/business");
  const tooltips = await getTooltips("business-analytics");
  return <AnalyticsClient tooltips={tooltips} />;
}
