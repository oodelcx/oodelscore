import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import { connectToDatabase, ParentOrganization } from "@oodelscore/shared";
import "../admin/admin.css";
import "../business/business.css";
import LogoutLink from "./logout-link";

export default async function GroupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isPrimaryOwner = user.accountType === "parent_org";
  const isOrgTeamMember = user.accountType === "team_member" && user.teamOfType === "parentOrg";
  if (!isPrimaryOwner && !isOrgTeamMember) redirect("/dashboard");

  const isLimitedTeamMember = isOrgTeamMember && user.tier === "limited";

  await connectToDatabase();
  const org = await ParentOrganization.findById(user.parentId).select("commandCenterEnabled");
  const commandCenterEnabled = org?.commandCenterEnabled ?? true;

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-top">
            <img className="admin-logo" src="/oodel-logo.png" alt="Oodel Score" />
            <div className="admin-brand-sub">PARENT ORGANISATION PORTAL</div>
          </div>
          {isLimitedTeamMember ? (
            <nav className="admin-nav">
              <a href="/group/action-board">My Action Items</a>
            </nav>
          ) : (
            <>
              <div className="nav-group-label">Organisation</div>
              <nav className="admin-nav">
                <a href="/group">Overview</a>
                {commandCenterEnabled && <a href="/group/command-center">Command Center</a>}
                <a href="/group/branches">Branches</a>
                <a href="/group/compare">Compare branches</a>
              </nav>
              <div className="nav-group-label">Listen</div>
              <nav className="admin-nav">
                <a href="/group/insights">Insights</a>
                <a href="/group/analytics">Analytics</a>
                <a href="/group/raw-feedback">Raw feedback</a>
                <a href="/group/alert-rules">Alert rules</a>
              </nav>
              <div className="nav-group-label">Act</div>
              <nav className="admin-nav">
                <a href="/group/action-board">Action board</a>
                <a href="/group/decision-log">Decision log</a>
                <a href="/group/playbooks">Playbooks</a>
              </nav>
              <div className="nav-group-label">Measure</div>
              <nav className="admin-nav">
                <a href="/group/maturity">CX Pulse</a>
              </nav>
              <div className="nav-group-label">Admin</div>
              <nav className="admin-nav">
                <a href="/group/team">Team &amp; access</a>
                {!isOrgTeamMember && <a href="/group/team-members">Team Members</a>}
                {!isOrgTeamMember && <a href="/group/category-owners">Category Owners</a>}
                <a href="/group/messages">Messages</a>
                {!isOrgTeamMember && <a href="/group/billing">Billing</a>}
              </nav>
            </>
          )}
        </div>
        <div className="admin-sidebar-bottom">
          {isLimitedTeamMember && (
            <div style={{ fontSize: 11.5, color: "#8b9096", marginBottom: 3 }}>
              👤 Team member{user.teamRole ? ` — ${user.teamRole}` : ""}
            </div>
          )}
          {isOrgTeamMember && !isLimitedTeamMember && (
            <div style={{ fontSize: 11.5, color: "#8b9096", marginBottom: 3 }}>
              👤 Team member{user.teamRole ? ` — ${user.teamRole}` : ""}
            </div>
          )}
          <div>{user.email}</div>
          <LogoutLink />
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
