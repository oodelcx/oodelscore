import { getTooltips } from "@/lib/tooltips";
import GroupOverviewClient from "./group-overview-client";

export default async function GroupOverviewPage() {
  const tooltips = await getTooltips("group-overview");
  return <GroupOverviewClient tooltips={tooltips} />;
}
