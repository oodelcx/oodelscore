import { getTooltips } from "@/lib/tooltips";
import { getColleagueWording } from "@/lib/wording";
import BusinessDecisionLogClient from "./decision-log-client";

export default async function BusinessDecisionLogPage() {
  const tooltips = await getTooltips("business-decision-log");
  const wording = await getColleagueWording();
  return <BusinessDecisionLogClient tooltips={tooltips} wording={wording} />;
}
