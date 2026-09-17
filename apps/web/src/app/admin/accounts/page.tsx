import { getTooltips } from "@/lib/tooltips";
import AccountsClient from "./accounts-client";

export default async function AccountsPage() {
  const tooltips = await getTooltips("admin-accounts");
  return <AccountsClient tooltips={tooltips} />;
}
