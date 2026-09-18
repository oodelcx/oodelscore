import { getTooltips } from "@/lib/tooltips";
import BranchesClient from "./branches-client";

export default async function BranchesPage() {
  const tooltips = await getTooltips("group-branches");
  return <BranchesClient tooltips={tooltips} />;
}
