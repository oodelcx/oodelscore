import { getTooltips } from "@/lib/tooltips";
import PlaybooksClient from "./playbooks-client";

export default async function PlaybooksPage() {
  const tooltips = await getTooltips("group-playbooks");
  return <PlaybooksClient tooltips={tooltips} />;
}
