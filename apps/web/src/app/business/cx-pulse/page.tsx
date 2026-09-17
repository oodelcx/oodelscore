import { getTooltips } from "@/lib/tooltips";
import BranchCxPulseClient from "./cx-pulse-client";

export default async function BranchCxPulsePage() {
  const tooltips = await getTooltips("business-cx-pulse");
  return <BranchCxPulseClient tooltips={tooltips} />;
}
