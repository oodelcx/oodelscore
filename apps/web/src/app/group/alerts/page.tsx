import { getTooltips } from "@/lib/tooltips";
import GroupAlertsClient from "./alerts-client";

export default async function GroupAlertsPage() {
  const tooltips = await getTooltips("group-alerts");
  return <GroupAlertsClient tooltips={tooltips} />;
}
