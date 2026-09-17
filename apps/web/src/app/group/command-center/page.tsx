import { getTooltips } from "@/lib/tooltips";
import GroupCommandCenterClient from "./command-center-client";

export default async function GroupCommandCenterPage() {
  const tooltips = await getTooltips("group-command-center");
  return <GroupCommandCenterClient tooltips={tooltips} />;
}
