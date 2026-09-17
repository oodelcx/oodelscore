import { getTooltips } from "@/lib/tooltips";
import CasesClient from "./cases-client";

export default async function GroupCasesPage() {
  const tooltips = await getTooltips("group-action-board");
  return <CasesClient tooltips={tooltips} />;
}
