import { getTooltips } from "@/lib/tooltips";
import GroupInsightsClient from "./insights-client";

export default async function GroupInsightsPage() {
  const tooltips = await getTooltips("group-insights");
  return <GroupInsightsClient tooltips={tooltips} />;
}
