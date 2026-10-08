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
import "../portal-refresh.css";
import LogoutLink from "./logout-link";
import MobileNavToggle from "@/components/mobile-nav-toggle";
import { TourProvider } from "@/components/tour/tour-provider";
import { TourLauncher } from "@/components/tour/tour-launcher";
import { BillingLockedScreen } from "@/components/billing-locked-screen";
import { NavSection } from "@/components/nav-section";
import { ProductViewSwitcher } from "@/components/product-view-switcher";
import { resolveViewProduct } from "@/lib/viewProduct";
import { AccessDenied } from "@/components/access-denied";
import { isAccessDenied, GROUP_ACCESS_CONFIG } from "@/lib/routeAccess";
import { NavIcon } from "@/components/nav-icon";

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
  // Single-product-only nav items (Insights/Analytics/Reports are CX-only;
  // Closing the Loop is CE-only) must also respect which tab is actually
  // active on a dual-product account — see business/layout.tsx's identical
  // comment for the bug this fixes.
  const showCx = !bothProductsEnabled || viewProduct === "customer_experience";
  const showCe = !bothProductsEnabled || viewProduct === "colleague_experience";
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
            <img className="admin-logo" src="/oodelcx-logo-dark.webp" alt="OodelCX" />
            <div className="admin-brand-sub">PARENT ORGANISATION PORTAL</div>
            {viewProduct && <ProductViewSwitcher current={viewProduct} />}
          </div>
          {isLimitedTeamMember ? (
            <nav className="admin-nav">
              <a href="/group/cases">
                <NavIcon name="cases" />
                My Cases
              </a>
            </nav>
          ) : (
            <>
              <NavSection
                storageKey="group-organisation"
                label="Organisation"
                hrefs={["/group", "/group/command-center", "/group/branches", "/group/compare", "/group/compass"]}
              >
                <a href="/group">
                  <NavIcon name="overview" />
                  Overview
                </a>
                {hasFeature(org.enabledFeatures, "compass") && teamMemberCanAccess(user, "compass") && (
                  <a href="/group/compass">
                    <NavIcon name="compass" />
                    OodelCX Compass
                  </a>
                )}
                {commandCenterEnabled && (
                  <a href="/group/command-center">
                    <NavIcon name="command-center" />
                    Command Center
                  </a>
                )}
                <a href="/group/branches">
                  <NavIcon name="branches" />
                  Branches
                </a>
                <a href="/group/compare">
                  <NavIcon name="compare" />
                  Compare branches
                </a>
              </NavSection>
              <NavSection storageKey="group-capture" label="Capture" hrefs={["/group/raw-feedback", "/group/feedback-points"]}>
                {teamMemberCanAccess(user, "feedbackPoints") && (
                  <a href="/group/feedback-points">
                    <NavIcon name="feedback-points" />
                    Feedback Points
                  </a>
                )}
                {teamMemberCanAccess(user, "rawFeedback") && (
                  <a href="/group/raw-feedback">
                    <NavIcon name="raw-feedback" />
                    Raw feedback
                  </a>
                )}
              </NavSection>

              <NavSection
                storageKey="group-clarify"
                label="Clarify"
                hrefs={[
                  "/group/insights",
                  "/group/analytics",
                  "/group/highlights",
                  "/group/alert-rules",
                  "/group/alerts",
                  "/group/business-value",
                  "/group/program-evaluation",
                ]}
              >
                {hasProduct(org, "customer_experience") &&
                  showCx &&
                  hasFeature(org.enabledFeatures, "insights") &&
                  teamMemberCanAccess(user, "insights") && (
                    <a href="/group/insights">
                      <NavIcon name="insights" />
                      Insights
                    </a>
                  )}
                {hasFeature(org.enabledFeatures, "highlights") && teamMemberCanAccess(user, "highlights") && (
                  <a href="/group/highlights">
                    <NavIcon name="insights" />
                    Highlights
                  </a>
                )}
                {hasProduct(org, "customer_experience") &&
                  showCx &&
                  hasFeature(org.enabledFeatures, "analytics") &&
                  teamMemberCanAccess(user, "analytics") && (
                    <a href="/group/analytics">
                      <NavIcon name="analytics" />
                      Analytics
                    </a>
                  )}
                {hasFeature(org.enabledFeatures, "alertRules") && teamMemberCanAccess(user, "alertRules") && (
                  <a href="/group/alert-rules">
                    <NavIcon name="alert-rules" />
                    Alert rules
                  </a>
                )}
                {hasFeature(org.enabledFeatures, "alertRules") && teamMemberCanAccess(user, "alerts") && (
                  <a href="/group/alerts">
                    <NavIcon name="alerts" />
                    Alerts
                  </a>
                )}
                {hasProduct(org, "customer_experience") && showCx && hasFeature(org.enabledFeatures, "businessValue") && teamMemberCanAccess(user, "businessValue") && (
                  <a href="/group/business-value">
                    <NavIcon name="business-value" />
                    Business Value
                  </a>
                )}
                {hasProduct(org, "customer_experience") && showCx && hasFeature(org.enabledFeatures, "programEvaluation") && teamMemberCanAccess(user, "programEvaluation") && (
                  <a href="/group/program-evaluation">
                    <NavIcon name="program-evaluation" />
                    Program Evaluation
                  </a>
                )}
              </NavSection>
              <NavSection
                storageKey="group-claim"
                label="Claim"
                hrefs={["/group/attention-centre", "/group/cases"]}
              >
                {teamMemberCanAccess(user, "attentionCentre") && (
                  <a href="/group/attention-centre">
                    <NavIcon name="attention-centre" />
                    Attention Centre
                  </a>
                )}
                {teamMemberCanAccess(user, "caseManagement") && (
                  <a href="/group/cases">
                    <NavIcon name="cases" />
                    Case Management
                  </a>
                )}
              </NavSection>

              <NavSection
                storageKey="group-close"
                label="Close"
                hrefs={["/group/improvement-initiatives", "/group/decision-log", "/group/closing-the-loop"]}
              >
                {hasFeature(org.enabledFeatures, "improvementInitiatives") &&
                  teamMemberCanAccess(user, "improvementInitiatives") && (
                    <a href="/group/improvement-initiatives">
                      <NavIcon name="improvement-initiatives" />
                      Improvement Initiatives
                    </a>
                  )}
                {hasFeature(org.enabledFeatures, "decisionLog") && teamMemberCanAccess(user, "decisionLog") && (
                  <a href="/group/decision-log">
                    <NavIcon name="decision-log" />
                    Decision log
                  </a>
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
                    storageKey="group-confirm"
                    label="Confirm"
                    defaultOpen={false}
                    hrefs={[cxPulseHref, "/group/cx-ex-correlation"]}
                  >
                    {showCxPulse && (
                      <a href={cxPulseHref}>
                        <NavIcon name="pulse" />
                        {cxPulseNavLabel}
                      </a>
                    )}
                    {showCorrelation && (
                      <a href="/group/cx-ex-correlation">
                        <NavIcon name="correlation" />
                        CX ↔ EX Correlation
                      </a>
                    )}
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
                  "/group/escalation",
                  "/group/playbooks",
                  "/group/security",
                ]}
              >
                <a href="/group/team">
                  <NavIcon name="team" />
                  Team &amp; access
                </a>
                {!isOrgTeamMember && (
                  <a href="/group/team-members">
                    <NavIcon name="team-members" />
                    Team Members
                  </a>
                )}
                {!isOrgTeamMember && (
                  <a href="/group/category-owners">
                    <NavIcon name="category-owners" />
                    Category Owners
                  </a>
                )}
                {teamMemberCanAccess(user, "support") && (
                  <a href="/group/support">
                    <NavIcon name="support" />
                    Support
                  </a>
                )}
                {!isOrgTeamMember && (
                  <a href="/group/billing">
                    <NavIcon name="billing" />
                    Billing
                  </a>
                )}
                {!isOrgTeamMember && (
                  <a href="/group/escalation">
                    <NavIcon name="escalation" />
                    Escalation hierarchy
                  </a>
                )}
                {hasFeature(org.enabledFeatures, "playbooks") && teamMemberCanAccess(user, "playbooks") && (
                  <a href="/group/playbooks">
                    <NavIcon name="playbooks" />
                    Playbook Library
                  </a>
                )}
                <a href="/group/security">
                  <NavIcon name="security" />
                  Security
                </a>
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
        ) : isAccessDenied(pathname, user, isOrgTeamMember, isLimitedTeamMember, GROUP_ACCESS_CONFIG) ? (
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
