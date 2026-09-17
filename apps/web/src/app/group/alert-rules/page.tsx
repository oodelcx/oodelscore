import { getTooltips } from "@/lib/tooltips";
import GroupAlertRulesClient from "./alert-rules-client";

export default async function GroupAlertRulesPage() {
  const tooltips = await getTooltips("group-alert-rules");
  return <GroupAlertRulesClient tooltips={tooltips} />;
}
