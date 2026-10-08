import { getTooltips } from "@/lib/tooltips";
import { redirectUnlessBranchAllowed } from "@/lib/productPageGuard";
import BusinessCategoryOwnersClient from "./category-owners-client";

export default async function BusinessCategoryOwnersPage() {
  await redirectUnlessBranchAllowed("categoryOwners");
  const tooltips = await getTooltips("business-category-owners");
  return <BusinessCategoryOwnersClient tooltips={tooltips} />;
}
