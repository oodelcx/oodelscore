import { redirect } from "next/navigation";

// The standalone Businesses list was folded into the unified Accounts tab
// (Admin → Accounts, filterable by Standalone/Branch/All). This route only
// still exists because /admin/businesses/[id] detail pages need a parent
// segment — nothing in the app links to the bare list anymore, but a
// bookmark or an old link shouldn't 404.
export default function AdminBusinessesRedirect() {
  redirect("/admin/accounts?filter=standalone");
}
