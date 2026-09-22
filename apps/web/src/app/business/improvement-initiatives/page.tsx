import { getTooltips } from "@/lib/tooltips";
import BusinessImprovementInitiativesClient from "./improvement-initiatives-client";

export default async function BusinessImprovementInitiativesPage() {
  const tooltips = await getTooltips("business-improvement-initiatives");
  return <BusinessImprovementInitiativesClient tooltips={tooltips} />;
}
