import { getTooltips } from "@/lib/tooltips";
import BusinessAlertsClient from "./alerts-client";

export default async function BusinessAlertsPage() {
  const tooltips = await getTooltips("business-alerts");
  return <BusinessAlertsClient tooltips={tooltips} />;
}
