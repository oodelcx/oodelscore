import { getTooltips } from "@/lib/tooltips";
import AnalyticsClient from "./analytics-client";

export default async function AnalyticsPage() {
  const tooltips = await getTooltips("business-analytics");
  return <AnalyticsClient tooltips={tooltips} />;
}
