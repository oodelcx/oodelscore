import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import "../admin/admin.css";

export default async function GroupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accountType !== "parent_org") redirect("/dashboard");

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-top">
            <div className="admin-brand">Oodel Score</div>
            <div className="admin-brand-sub">GROUP</div>
          </div>
          <nav className="admin-nav">
            <a href="/group">Businesses</a>
            <a href="/group/alert-rules">Alert Rules</a>
            <a href="/group/action-board">Action Board</a>
            <a href="/group/decision-log">Decision Log</a>
            <a href="/group/playbooks">Playbooks</a>
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
