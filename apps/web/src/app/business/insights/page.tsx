import { getTooltips } from "@/lib/tooltips";
import InsightsClient from "./insights-client";

export default async function InsightsPage() {
  const tooltips = await getTooltips("business-insights");
  return <InsightsClient tooltips={tooltips} />;
}
