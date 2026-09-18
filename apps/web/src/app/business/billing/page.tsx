import { getTooltips } from "@/lib/tooltips";
import BillingClient from "./billing-client";

export default async function BillingPage() {
  const tooltips = await getTooltips("business-billing");
  return <BillingClient tooltips={tooltips} />;
}
