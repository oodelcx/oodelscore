import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import "../admin/admin.css";

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accountType !== "business") redirect("/dashboard");

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-top">
            <div className="admin-brand">Oodel Score</div>
            <div className="admin-brand-sub">BUSINESS</div>
          </div>
          <nav className="admin-nav">
            <a href="/business">Overview</a>
            <a href="/business/feedback-points">Feedback Points</a>
            <a href="/business/responses">Raw Feedback</a>
            <a href="/business/alert-rules">Alert Rules</a>
          </nav>
        </div>
        <div className="admin-sidebar-bottom">
          <div>{user.email}</div>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
