import { getTooltips } from "@/lib/tooltips";
import BusinessAlertRulesClient from "./alert-rules-client";

export default async function BusinessAlertRulesPage() {
  const tooltips = await getTooltips("business-alert-rules");
  return <BusinessAlertRulesClient tooltips={tooltips} />;
}
