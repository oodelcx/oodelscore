import { redirect } from "next/navigation";

// The standalone Parent Organizations list was folded into the unified
// Accounts tab (Admin → Accounts → Parent Organizations). This route only
// still exists because /admin/parent-orgs/[id] detail pages need a parent
// segment — nothing in the app links to the bare list anymore, but a
// bookmark or an old link shouldn't 404.
export default function AdminParentOrgsRedirect() {
  redirect("/admin/accounts?tab=orgs");
}
