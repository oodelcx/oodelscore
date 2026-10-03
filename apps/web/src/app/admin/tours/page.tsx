import { redirect } from "next/navigation";

// Moved to Admin -> Content settings (Phase 4 item 17): guided-tour copy is
// a CMS toy, consolidated alongside site name and CX Pulse ladder text.
// Kept as a redirect so any existing bookmark to this URL still lands.
export default function AdminToursRedirect() {
  redirect("/admin/content");
}
