import { redirect } from "next/navigation";

// "Action Board" was renamed "Case Management" and moved to /business/cases.
// This route stays in place, redirecting, so old bookmarks/links don't 404.
export default function BusinessActionBoardRedirect() {
  redirect("/business/cases");
}
