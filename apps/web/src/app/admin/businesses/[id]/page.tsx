import { getTooltips } from "@/lib/tooltips";
import BusinessDetailClient from "./business-detail-client";

export default async function BusinessDetailPage() {
  const tooltips = await getTooltips("admin-business-detail");
  return <BusinessDetailClient tooltips={tooltips} />;
}
