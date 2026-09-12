import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import "./admin.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accountType !== "admin_staff") redirect("/dashboard");

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-top">
            <div className="admin-brand">Oodel Score</div>
            <div className="admin-brand-sub">ADMIN</div>
          </div>
          <nav className="admin-nav">
            <a href="/admin/accounts">Accounts</a>
            <a href="/admin/industries">Industries</a>
            <a href="/admin/question-templates">Question Templates</a>
            <a href="/admin/billing">Billing Oversight</a>
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
