import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import { connectToDatabase, Business, ParentOrganization } from "@oodelscore/shared";
import LogoutLink from "./logout-link";
import MobileNavToggle from "@/components/mobile-nav-toggle";
import "../admin/admin.css";
import "./business.css";

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isPrimaryOwner = user.accountType === "business";
  const isBusinessTeamMember = user.accountType === "team_member" && user.teamOfType === "business";
  if (!isPrimaryOwner && !isBusinessTeamMember) redirect("/dashboard");

  await connectToDatabase();
  const business = await Business.findById(user.parentId);
  if (!business) redirect("/login");

  const parentOrg = business.parentOrgId ? await ParentOrganization.findById(business.parentOrgId) : null;
  const isBranch = !!parentOrg;
  const isLimitedTeamMember = isBusinessTeamMember && user.tier === "limited";

  return (
    <div className="admin-app">
      <MobileNavToggle label={business.name} />
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-top">
            <img className="admin-logo" src="/oodelcx-logo-white.webp" alt="OodelCX" />
            <div className="admin-brand-sub">BUSINESS PORTAL</div>
          </div>
          {isLimitedTeamMember ? (
            <nav className="admin-nav">
              <a href="/business/cases">My Cases</a>
            </nav>
          ) : (
            <>
              <nav className="admin-nav">
                <a href="/business">Dashboard</a>
              </nav>

              <div className="nav-group-label">Setup</div>
              <nav className="admin-nav">
                <a href="/business/feedback-points">Feedback Points</a>
                {!isBusinessTeamMember && <a href="/business/category-owners">Category Owners</a>}
              </nav>

              <div className="nav-group-label">Listen</div>
              <nav className="admin-nav">
                <a href="/business/responses">Raw Feedback</a>
              </nav>

              <div className="nav-group-label">Understand</div>
              <nav className="admin-nav">
                <a href="/business/insights">Insights</a>
                <a href="/business/analytics">Analytics</a>
                <a href="/business/alert-rules">Alert Rules</a>
              </nav>

              <div className="nav-group-label">Act</div>
              <nav className="admin-nav">
                <a href="/business/cases">Case Management</a>
                <a href="/business/decision-log">Decision Log</a>
              </nav>

              {isBranch && (
                <>
                  <div className="nav-group-label">Measure</div>
                  <nav className="admin-nav">
                    <a href="/business/cx-pulse">CX Pulse</a>
                  </nav>
                </>
              )}

              <div className="nav-group-label">Admin</div>
              <nav className="admin-nav">
                {!isBusinessTeamMember && <a href="/business/team-members">Team Members</a>}
                <a href="/business/messages">Messages</a>
                {!isBusinessTeamMember && <a href="/business/billing">Billing</a>}
                <a href="/business/playbooks">Playbook Library</a>
                <a href="/business/security">Security</a>
              </nav>
            </>
          )}
        </div>
        <div className="admin-sidebar-bottom">
          <div style={{ color: "#fff", fontWeight: 500 }}>{business.name}</div>
          {isBranch && (
            <div style={{ fontSize: 11.5, color: "#8b9096", marginTop: 3 }}>🏢 Part of {parentOrg!.name}</div>
          )}
          {isBusinessTeamMember && (
            <div style={{ fontSize: 11.5, color: "#8b9096", marginTop: 3 }}>
              👤 Team member{user.teamRole ? ` — ${user.teamRole}` : ""}
            </div>
          )}
          <div style={{ color: "#787d82", fontSize: 12, marginTop: 6 }}>{user.email}</div>
          <LogoutLink />
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
