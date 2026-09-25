import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import {
  connectToDatabase,
  ParentOrganization,
  PlatformSettings,
  PLATFORM_SETTINGS_SINGLETON_KEY,
  getBillingAccessStatus,
  hasFeature,
  hasProduct,
  primaryProductFor,
  teamMemberCanAccess,
} from "@oodelscore/shared";
import "../admin/admin.css";
import "../business/business.css";
import LogoutLink from "./logout-link";
import MobileNavToggle from "@/components/mobile-nav-toggle";
import { TourProvider } from "@/components/tour/tour-provider";
import { TourLauncher } from "@/components/tour/tour-launcher";
import { BillingLockedScreen } from "@/components/billing-locked-screen";
import { NavSection } from "@/components/nav-section";
import { ProductViewSwitcher } from "@/components/product-view-switcher";
import { resolveViewProduct } from "@/lib/viewProduct";
import { AccessDenied } from "@/components/access-denied";
import type { TeamPageKey } from "@oodelscore/shared";

// Maps a Group route to the permission key that gates its nav link (see the
// teamMemberCanAccess() calls in this file's nav below) — a Team Member
// whose permissions hide a link can still type the URL directly, so without
// this the page would render with a 403'd API response and no explanation.
// Longest-prefix match, so a nested route (e.g. /group/cases/<id>) resolves
// to its parent page's key.
const PAGE_ACCESS_KEYS: [string, TeamPageKey][] = [
  ["/group/raw-feedback", "rawFeedback"],
  ["/group/insights", "insights"],
  ["/group/analytics", "analytics"],
  ["/group/alert-rules", "alertRules"],
  ["/group/reports", "reports"],
  ["/group/improvement-initiatives", "improvementInitiatives"],
  ["/group/decision-log", "decisionLog"],
  ["/group/maturity", "cxPulse"],
  ["/group/ex-pulse", "exPulse"],
  ["/group/cx-ex-correlation", "cxExCorrelation"],
  ["/group/playbooks", "playbooks"],
  ["/group/support", "support"],
  ["/group/cases", "caseManagement"],
];

function pageKeyForPath(pathname: string): TeamPageKey | null {
  const match = PAGE_ACCESS_KEYS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1] : null;
}

// See business/layout.tsx for the same pattern. These three have no
// TeamPageKey — they're not a togglable per-person permission, they're only
// ever shown to the primary owner login to begin with (see the
// !isOrgTeamMember nav guards above). An org Team Member of either tier
// hitting one directly by URL used to fall through pageKeyForPath()
// returning null, which the gate below reads as "nothing to check" and
// rendered the real page against data shaped for an owner session.
const OWNER_ONLY_ROUTES = ["/group/billing", "/group/team-members", "/group/category-owners"];
function isOwnerOnlyRoute(pathname: string): boolean {
  return OWNER_ONLY_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default async function GroupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isPrimaryOwner = user.accountType === "parent_org";
  const isOrgTeamMember = user.accountType === "team_member" && user.teamOfType === "parentOrg";
  if (!isPrimaryOwner && !isOrgTeamMember) redirect("/dashboard");

  const isLimitedTeamMember = isOrgTeamMember && user.tier === "limited";

  await connectToDatabase();
  const org = await ParentOrganization.findById(user.parentId).select(
    "commandCenterEnabled enabledFeatures enabledProducts paymentGateEnabled"
  );
  if (!org) redirect("/login");
  const commandCenterEnabled = org.commandCenterEnabled ?? true;
  const platformSettings = await PlatformSettings.findOne({ singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY }).select(
    "toursEnabled paymentGateEnabled"
  );
  const toursEnabled = platformSettings?.toursEnabled ?? true;

  // See business/layout.tsx for the same per-account override pattern.
  const gateEnabled = org.paymentGateEnabled ?? platformSettings?.paymentGateEnabled ?? false;
  const billingStatus = gateEnabled ? await getBillingAccessStatus("parentOrg", org._id.toString()) : "active";
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isBillingRoute = pathname.startsWith("/group/billing");
  const isGated = billingStatus !== "active" && !isBillingRoute;
  const bothProductsEnabled = hasProduct(org, "customer_experience") && hasProduct(org, "colleague_experience");
  const viewProduct = bothProductsEnabled ? await resolveViewProduct(org) : null;
  // Which product "CX Pulse" in the nav should point at — the two pages
  // (the CX maturity ladder and its Colleague Experience analogue) share
  // the one label per the branding rule (CX means whichever product you're
  // currently viewing), so only ever one is shown, never both at once.
  const cxPulseNavProduct = viewProduct ?? primaryProductFor(org);

  return (
    <div className="admin-app">
      <div data-no-print>
        <MobileNavToggle label="Parent Organisation Portal" />
      </div>
      <aside className="admin-sidebar" data-no-print>
        <div className="admin-sidebar-scroll">
          <div className="admin-sidebar-top">
            <img className="admin-logo" src="/oodelcx-logo-white.webp" alt="OodelCX" />
            <div className="admin-brand-sub">PARENT ORGANISATION PORTAL</div>
            {viewProduct && <ProductViewSwitcher current={viewProduct} />}
          </div>
          {isLimitedTeamMember ? (
            <nav className="admin-nav">
              <a href="/group/cases">My Cases</a>
            </nav>
          ) : (
            <>
              <NavSection
                storageKey="group-organisation"
                label="Organisation"
                hrefs={["/group", "/group/command-center", "/group/branches", "/group/compare"]}
              >
                <a href="/group">Overview</a>
                {commandCenterEnabled && <a href="/group/command-center">Command Center</a>}
                <a href="/group/branches">Branches</a>
                <a href="/group/compare">Compare branches</a>
              </NavSection>
              <NavSection storageKey="group-listen" label="Listen" hrefs={["/group/raw-feedback"]}>
                {teamMemberCanAccess(user, "rawFeedback") && <a href="/group/raw-feedback">Raw feedback</a>}
              </NavSection>

              <NavSection
                storageKey="group-understand"
                label="Understand"
                hrefs={["/group/insights", "/group/analytics", "/group/alert-rules", "/group/reports"]}
              >
                {hasProduct(org, "customer_experience") &&
                  hasFeature(org.enabledFeatures, "insights") &&
                  teamMemberCanAccess(user, "insights") && <a href="/group/insights">Insights</a>}
                {hasProduct(org, "customer_experience") &&
                  hasFeature(org.enabledFeatures, "analytics") &&
                  teamMemberCanAccess(user, "analytics") && <a href="/group/analytics">Analytics</a>}
                {hasFeature(org.enabledFeatures, "alertRules") && teamMemberCanAccess(user, "alertRules") && (
                  <a href="/group/alert-rules">Alert rules</a>
                )}
                {hasProduct(org, "customer_experience") &&
                  hasFeature(org.enabledFeatures, "reports") &&
                  teamMemberCanAccess(user, "reports") && <a href="/group/reports">Reports</a>}
              </NavSection>
              <NavSection
                storageKey="group-act"
                label="Act"
                hrefs={["/group/cases", "/group/improvement-initiatives", "/group/decision-log"]}
              >
                {teamMemberCanAccess(user, "caseManagement") && <a href="/group/cases">Case Management</a>}
                {hasFeature(org.enabledFeatures, "improvementInitiatives") &&
                  teamMemberCanAccess(user, "improvementInitiatives") && (
                    <a href="/group/improvement-initiatives">Improvement Initiatives</a>
                  )}
                {hasFeature(org.enabledFeatures, "decisionLog") && teamMemberCanAccess(user, "decisionLog") && (
                  <a href="/group/decision-log">Decision log</a>
                )}
              </NavSection>
              {(() => {
                const showCxPulse =
                  cxPulseNavProduct === "customer_experience"
                    ? hasProduct(org, "customer_experience") && hasFeature(org.enabledFeatures, "cxPulse") && teamMemberCanAccess(user, "cxPulse")
                    : hasProduct(org, "colleague_experience") && teamMemberCanAccess(user, "exPulse");
                const cxPulseHref = cxPulseNavProduct === "customer_experience" ? "/group/maturity" : "/group/ex-pulse";
                const cxPulseNavLabel = cxPulseNavProduct === "customer_experience" ? "CX Pulse" : "Colleague Pulse";
                // Only ever meaningful for a dual-product account — a
                // network-level view of both signals together, so it's
                // gated the same way the switcher itself is (bothProductsEnabled),
                // not tied to whichever single product the tab happens to
                // be on right now.
                const showCorrelation = bothProductsEnabled && teamMemberCanAccess(user, "cxExCorrelation");
                if (!showCxPulse && !showCorrelation) return null;
                return (
                  <NavSection
                    storageKey="group-measure"
                    label="Measure"
                    defaultOpen={false}
                    hrefs={[cxPulseHref, "/group/cx-ex-correlation"]}
                  >
                    {showCxPulse && <a href={cxPulseHref}>{cxPulseNavLabel}</a>}
                    {showCorrelation && <a href="/group/cx-ex-correlation">CX ↔ EX Correlation</a>}
                  </NavSection>
                );
              })()}

              <NavSection
                storageKey="group-admin"
                label="Admin"
                defaultOpen={false}
                hrefs={[
                  "/group/team",
                  "/group/team-members",
                  "/group/category-owners",
                  "/group/support",
                  "/group/billing",
                  "/group/playbooks",
                  "/group/security",
                ]}
              >
                <a href="/group/team">Team &amp; access</a>
                {!isOrgTeamMember && <a href="/group/team-members">Team Members</a>}
                {!isOrgTeamMember && <a href="/group/category-owners">Category Owners</a>}
                {teamMemberCanAccess(user, "support") && <a href="/group/support">Support</a>}
                {!isOrgTeamMember && <a href="/group/billing">Billing</a>}
                {hasFeature(org.enabledFeatures, "playbooks") && teamMemberCanAccess(user, "playbooks") && (
                  <a href="/group/playbooks">Playbook Library</a>
                )}
                <a href="/group/security">Security</a>
              </NavSection>
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
          <LogoutLink />
        </div>
      </aside>
      <main className="admin-main">
        {isGated ? (
          <BillingLockedScreen
            billingHref="/group/billing"
            status={billingStatus === "never_activated" ? "never_activated" : "lapsed"}
          />
        ) : (() => {
            if (isOrgTeamMember && isOwnerOnlyRoute(pathname)) return true;
            // Dashboard root ("/group" exactly — not a prefix match, so it
            // doesn't also swallow every other group/* route): the nav
            // itself only shows this link to non-limited users (see the
            // isLimitedTeamMember ? ... nav above), and the page's own
            // data shape assumes a full owner/full-tier session.
            if (isLimitedTeamMember && pathname === "/group") return true;
            const pageKey = pageKeyForPath(pathname);
            return !!pageKey && !teamMemberCanAccess(user, pageKey);
          })() ? (
          <AccessDenied />
        ) : toursEnabled ? (
          <TourProvider initialSeenTours={[...user.seenTours]}>
            <TourLauncher />
            <div key={viewProduct ?? "single-product"}>{children}</div>
          </TourProvider>
        ) : (
          <div key={viewProduct ?? "single-product"}>{children}</div>
        )}
      </main>
    </div>
  );
}
