import { getTooltips } from "@/lib/tooltips";
import GroupImprovementInitiativesClient from "./improvement-initiatives-client";

export default async function GroupImprovementInitiativesPage() {
  const tooltips = await getTooltips("group-improvement-initiatives");
  return <GroupImprovementInitiativesClient tooltips={tooltips} />;
}
