import { getTooltips } from "@/lib/tooltips";
import AdminCommandCenterClient from "./command-center-client";

export default async function AdminCommandCenterPage() {
  const tooltips = await getTooltips("admin-command-center");
  return <AdminCommandCenterClient tooltips={tooltips} />;
}
