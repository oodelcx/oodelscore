import { getTooltips } from "@/lib/tooltips";
import { getColleagueWording } from "@/lib/wording";
import DecisionLogClient from "./decision-log-client";

export default async function DecisionLogPage() {
  const tooltips = await getTooltips("group-decision-log");
  const wording = await getColleagueWording();
  return <DecisionLogClient tooltips={tooltips} wording={wording} />;
}
