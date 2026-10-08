import { getTooltips } from "@/lib/tooltips";
import { redirectUnlessBranchAllowed } from "@/lib/productPageGuard";
import BusinessAlertRulesClient from "./alert-rules-client";

export default async function BusinessAlertRulesPage() {
  await redirectUnlessBranchAllowed("alertRules");
  const tooltips = await getTooltips("business-alert-rules");
  return <BusinessAlertRulesClient tooltips={tooltips} />;
}
