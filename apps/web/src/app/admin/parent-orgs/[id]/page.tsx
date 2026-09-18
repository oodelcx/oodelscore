import { getTooltips } from "@/lib/tooltips";
import ParentOrgDetailClient from "./parent-org-detail-client";

export default async function ParentOrgDetailPage() {
  const tooltips = await getTooltips("admin-parent-org-detail");
  return <ParentOrgDetailClient tooltips={tooltips} />;
}
