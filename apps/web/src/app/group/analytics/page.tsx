import { getTooltips } from "@/lib/tooltips";
import GroupAnalyticsClient from "./analytics-client";

export default async function GroupAnalyticsPage() {
  const tooltips = await getTooltips("group-analytics");
  return <GroupAnalyticsClient tooltips={tooltips} />;
}
