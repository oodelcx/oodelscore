import { getTooltips } from "@/lib/tooltips";
import MaturityClient from "./maturity-client";

export default async function MaturityPage() {
  const tooltips = await getTooltips("group-maturity");
  return <MaturityClient tooltips={tooltips} />;
}
