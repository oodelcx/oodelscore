import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import { requireStaffSession } from "@/lib/adminAuth";
import { connectToDatabase, AiInsightReport, Business, FeedbackPointRequest } from "@oodelscore/shared";
import LogoutLink from "./logout-link";
import "./admin.css";

/**
 * Pending-AI-reports badge for the sidebar nav, scoped the same way the
 * queue page itself is scoped (spec Section 4: account managers only see
 * "assigned" businesses' reports).
 */
async function getPendingAiCount(): Promise<number> {
  const session = await requireStaffSession();
  if (!session) return 0;
  const { role, user } = session;
  if (!role.permissions.aiInsightsQueue.view) return 0;

  await connectToDatabase();
  if (role.permissions.aiInsightsQueue.scope === "all") {
    return AiInsightReport.countDocuments({ status: "pending" });
  }
  const businessIds = await Business.find({ accountManagerId: user._id }).distinct("_id");
  return AiInsightReport.countDocuments({ status: "pending", ownerType: "business", ownerId: { $in: businessIds } });
}

/** Same scoping as the Feedback Point Requests page itself. */
async function getPendingFeedbackRequestCount(): Promise<number> {
  const session = await requireStaffSession();
  if (!session) return 0;
  const { role, user } = session;
  if (!role.permissions.businesses.view) return 0;

  await connectToDatabase();
  const businessFilter = role.permissions.businesses.scope === "assigned" ? { accountManagerId: user._id } : {};
  const scopedBusinessIds = await Business.find(businessFilter).distinct("_id");
  return FeedbackPointRequest.countDocuments({ status: "pending", businessId: { $in: scopedBusinessIds } });
}

/**
 * Dev Data Tools (showcase seed / wipe) are dangerous by design — only ever
 * shown when a staff member with the "Admin" system role is logged in AND
 * the deploying environment has explicitly opted in via
 * ENABLE_DEV_DATA_TOOLS=true. Never set that flag on production.
 */
async function canSeeDevTools(): Promise<boolean> {
  if (process.env.ENABLE_DEV_DATA_TOOLS !== "true") return false;
  const session = await requireStaffSession();
  return session?.role.name === "Admin";
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accountType !== "admin_staff") redirect("/dashboard");

  const pendingAiCount = await getPendingAiCount();
  const pendingFeedbackRequestCount = await getPendingFeedbackRequestCount();
  const devToolsVisible = await canSeeDevTools();

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-top">
            <img className="admin-logo" src="/oodelcx-logo-white.webp" alt="OodelCX" />
            <div className="admin-brand-sub">ADMIN PORTAL</div>
          </div>

          <div className="nav-group-label">Platform</div>
          <nav className="admin-nav">
            <a href="/admin">Overview</a>
            <a href="/admin/command-center">Command Center</a>
          </nav>

          <div className="nav-group-label">Accounts</div>
          <nav className="admin-nav">
            <a href="/admin/accounts">Accounts</a>
          </nav>

          <div className="nav-group-label">Survey setup</div>
          <nav className="admin-nav">
            <a href="/admin/question-templates">Question Templates</a>
            <a href="/admin/categories">Categories</a>
            <a href="/admin/industries">Industries</a>
          </nav>

          <div className="nav-group-label">Content</div>
          <nav className="admin-nav">
            <a href="/admin/email-templates">Email Templates</a>
            <a href="/admin/site-content">Site Content</a>
            <a href="/admin/contact-messages">Contact Messages</a>
          </nav>

          <div className="nav-group-label">Oversight</div>
          <nav className="admin-nav">
            <a href="/admin/feedback-responses">Feedback Responses</a>
            <a href="/admin/feedback-requests" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Feedback Point Requests</span>
              {pendingFeedbackRequestCount > 0 && <span className="nav-badge">{pendingFeedbackRequestCount}</span>}
            </a>
            <a href="/admin/ai-queue" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>AI Insights Queue</span>
              {pendingAiCount > 0 && <span className="nav-badge">{pendingAiCount}</span>}
            </a>
            <a href="/admin/alert-rules">Alert Rules</a>
            <a href="/admin/billing">Billing Oversight</a>
            <a href="/admin/cx-pulse">CX Pulse</a>
            <a href="/admin/audit-log">Audit Log</a>
          </nav>

          <div className="nav-group-label">Account</div>
          <nav className="admin-nav">
            <a href="/admin/security">Security</a>
          </nav>

          {devToolsVisible && (
            <>
              <div className="nav-group-label">Danger zone</div>
              <nav className="admin-nav">
                <a href="/admin/dev-tools">Dev Data Tools</a>
              </nav>
            </>
          )}
        </div>
        <div className="admin-sidebar-bottom">
          <div className="biz">OodelCX Admin</div>
          <div className="email">{user.email}</div>
          <LogoutLink />
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
