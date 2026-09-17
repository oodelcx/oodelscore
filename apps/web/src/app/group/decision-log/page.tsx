import { getTooltips } from "@/lib/tooltips";
import DecisionLogClient from "./decision-log-client";

export default async function DecisionLogPage() {
  const tooltips = await getTooltips("group-decision-log");
  return <DecisionLogClient tooltips={tooltips} />;
}
