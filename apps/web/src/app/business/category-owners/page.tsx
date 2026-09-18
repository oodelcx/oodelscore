import { getTooltips } from "@/lib/tooltips";
import BusinessCategoryOwnersClient from "./category-owners-client";

export default async function BusinessCategoryOwnersPage() {
  const tooltips = await getTooltips("business-category-owners");
  return <BusinessCategoryOwnersClient tooltips={tooltips} />;
}
