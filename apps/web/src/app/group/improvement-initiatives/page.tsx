import { getTooltips } from "@/lib/tooltips";
import { getColleagueWording } from "@/lib/wording";
import GroupImprovementInitiativesClient from "./improvement-initiatives-client";

export default async function GroupImprovementInitiativesPage() {
  const tooltips = await getTooltips("group-improvement-initiatives");
  const wording = await getColleagueWording();
  return <GroupImprovementInitiativesClient tooltips={tooltips} wording={wording} />;
}
