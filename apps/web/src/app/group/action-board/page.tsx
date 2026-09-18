import { redirect } from "next/navigation";

// "Action Board" was renamed "Case Management" and moved to /group/cases.
// This route stays in place, redirecting, so old bookmarks/links don't 404.
export default function GroupActionBoardRedirect() {
  redirect("/group/cases");
}
