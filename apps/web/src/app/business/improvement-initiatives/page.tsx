import { getTooltips } from "@/lib/tooltips";
import { getColleagueWording } from "@/lib/wording";
import BusinessImprovementInitiativesClient from "./improvement-initiatives-client";

export default async function BusinessImprovementInitiativesPage() {
  const tooltips = await getTooltips("business-improvement-initiatives");
  const wording = await getColleagueWording();
  return <BusinessImprovementInitiativesClient tooltips={tooltips} wording={wording} />;
}
