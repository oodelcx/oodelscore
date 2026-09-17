import { getTooltips } from "@/lib/tooltips";
import BusinessDashboardClient from "./business-dashboard-client";

export default async function BusinessDashboardPage() {
  const tooltips = await getTooltips("business-dashboard");
  return <BusinessDashboardClient tooltips={tooltips} />;
}
