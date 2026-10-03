import { redirect } from "next/navigation";

// Reports was merged into Analytics (QA8) — a "Report" tab there now covers
// what this page used to. Keep the route alive so old bookmarks/emails don't 404.
export default function GroupReportsPage() {
  redirect("/group/analytics");
}
