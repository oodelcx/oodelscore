import { getTooltips } from "@/lib/tooltips";
import BusinessDecisionLogClient from "./decision-log-client";

export default async function BusinessDecisionLogPage() {
  const tooltips = await getTooltips("business-decision-log");
  return <BusinessDecisionLogClient tooltips={tooltips} />;
}
