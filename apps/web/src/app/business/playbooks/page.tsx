import { getTooltips } from "@/lib/tooltips";
import BusinessPlaybooksClient from "./playbooks-client";

export default async function BusinessPlaybooksPage() {
  const tooltips = await getTooltips("business-playbooks");
  return <BusinessPlaybooksClient tooltips={tooltips} />;
}
