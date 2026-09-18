import { getTooltips } from "@/lib/tooltips";
import CompareClient from "./compare-client";

export default async function ComparePage() {
  const tooltips = await getTooltips("group-compare");
  return <CompareClient tooltips={tooltips} />;
}
