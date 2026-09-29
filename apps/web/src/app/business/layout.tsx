import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import {
  connectToDatabase,
  Business,
  ParentOrganization,
  PlatformSettings,
  PLATFORM_SETTINGS_SINGLETON_KEY,
  getBillingAccessStatus,
  hasFeature,
  hasProduct,
  primaryProductFor,
  teamMemberCanAccess,
} from "@oodelscore/shared";
import LogoutLink from "./logout-link";
import { BillingLockedScreen } from "@/components/billing-locked-screen";
import MobileNavToggle from "@/components/mobile-nav-toggle";
import { TourProvider } from "@/components/tour/tour-provider";
import { TourLauncher } from "@/components/tour/tour-launcher";
import { NavSection } from "@/components/nav-section";
import { ProductViewSwitcher } from "@/components/product-view-switcher";
import { resolveViewProduct } from "@/lib/viewProduct";
import { AccessDenied } from "@/components/access-denied";
import { isAccessDenied, BUSINESS_ACCESS_CONFIG } from "@/lib/routeAccess";
import { NavIcon } from "@/components/nav-icon";
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
  const platformSettings = await PlatformSettings.findOne({ singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY }).select(
    "toursEnabled paymentGateEnabled"
  );
  const toursEnabled = platformSettings?.toursEnabled ?? true;

  // Payment gate: a group_pays branch rides its org's subscription, not one
  // of its own, so the gate follows whichever entity actually owns the
  // billing. Each Business/ParentOrganization can override the platform
  // default individually (paymentGateEnabled: null = follow the platform
  // default, true/false = force it for this one account) — accounts
  // created before Stripe billing existed have no BillingSubscription row
  // at all, so this must stay off by default rather than lock them out the
  // moment gating is turned on somewhere else on the platform.
  const billingOwner =
    business.billingAssignment === "group_pays" && business.parentOrgId
      ? ({ ownerType: "parentOrg" as const, ownerId: business.parentOrgId.toString() })
      : ({ ownerType: "business" as const, ownerId: business._id.toString() });
  const gateOverride = billingOwner.ownerType === "parentOrg" ? parentOrg?.paymentGateEnabled : business.paymentGateEnabled;
  const gateEnabled = gateOverride ?? platformSettings?.paymentGateEnabled ?? false;
  const billingStatus = gateEnabled ? await getBillingAccessStatus(billingOwner.ownerType, billingOwner.ownerId) : "active";
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isBillingRoute = pathname.startsWith("/business/billing");
  const isGated = billingStatus !== "active" && !isBillingRoute;
  const bothProductsEnabled = hasProduct(business, "customer_experience") && hasProduct(business, "colleague_experience");
  const viewProduct = bothProductsEnabled ? await resolveViewProduct(business) : null;
  // See group/layout.tsx for the same reasoning: "CX Pulse" is one nav
  // entry that points at whichever product's maturity page you're viewing,
  // never two identically-labeled entries at once.
  const cxPulseNavProduct = viewProduct ?? primaryProductFor(business);

  return (
    <div className="admin-app">
      <div data-no-print>
        <MobileNavToggle label={business.name} />
      </div>
      <aside className="admin-sidebar" data-no-print>
        <div className="admin-sidebar-scroll">
          <div className="admin-sidebar-top">
            <img className="admin-logo" src="/oodelcx-logo-white.webp" alt="OodelCX" />
            <div className="admin-brand-sub">BUSINESS PORTAL</div>
            {viewProduct && <ProductViewSwitcher current={viewProduct} />}
          </div>
          {isLimitedTeamMember ? (
            <nav className="admin-nav">
              <a href="/business/cases">
                <NavIcon name="cases" />
                My Cases
              </a>
            </nav>
          ) : (
            <>
              <nav className="admin-nav">
                <a href="/business">
                  <NavIcon name="dashboard" />
                  Dashboard
                </a>
              </nav>

              <NavSection
                storageKey="business-setup"
                label="Setup"
                hrefs={["/business/feedback-points", "/business/category-owners", "/business/roster"]}
              >
                {teamMemberCanAccess(user, "feedbackPoints") && (
                  <a href="/business/feedback-points">
                    <NavIcon name="feedback-points" />
                    Feedback Points
                  </a>
                )}
                {!isBusinessTeamMember && (
                  <a href="/business/category-owners">
                    <NavIcon name="category-owners" />
                    Category Owners
                  </a>
                )}
                {hasProduct(business, "colleague_experience") && teamMemberCanAccess(user, "colleagueRoster") && (
                  <a href="/business/roster">
                    <NavIcon name="roster" />
                    Roster
                  </a>
                )}
              </NavSection>

              <NavSection storageKey="business-listen" label="Listen" hrefs={["/business/responses"]}>
                {teamMemberCanAccess(user, "rawFeedback") && (
                  <a href="/business/responses">
                    <NavIcon name="raw-feedback" />
                    Raw Feedback
                  </a>
                )}
              </NavSection>

              <NavSection
                storageKey="business-understand"
                label="Understand"
                hrefs={[
                  "/business/insights",
                  "/business/analytics",
                  "/business/alert-rules",
                  "/business/alerts",
                  "/business/reports",
                  "/business/business-value",
                ]}
              >
                {hasProduct(business, "customer_experience") &&
                  hasFeature(business.enabledFeatures, "insights") &&
                  teamMemberCanAccess(user, "insights") && (
                    <a href="/business/insights">
                      <NavIcon name="insights" />
                      Insights
                    </a>
                  )}
                {hasProduct(business, "customer_experience") &&
                  hasFeature(business.enabledFeatures, "analytics") &&
                  teamMemberCanAccess(user, "analytics") && (
                    <a href="/business/analytics">
                      <NavIcon name="analytics" />
                      Analytics
                    </a>
                  )}
                {hasFeature(business.enabledFeatures, "alertRules") && teamMemberCanAccess(user, "alertRules") && (
                  <a href="/business/alert-rules">
                    <NavIcon name="alert-rules" />
                    Alert Rules
                  </a>
                )}
                {hasFeature(business.enabledFeatures, "alertRules") && teamMemberCanAccess(user, "alerts") && (
                  <a href="/business/alerts">
                    <NavIcon name="alerts" />
                    Alerts
                  </a>
                )}
                {hasProduct(business, "customer_experience") &&
                  hasFeature(business.enabledFeatures, "reports") &&
                  teamMemberCanAccess(user, "reports") && (
                    <a href="/business/reports">
                      <NavIcon name="reports" />
                      Reports
                    </a>
                  )}
                {hasFeature(business.enabledFeatures, "businessValue") && teamMemberCanAccess(user, "businessValue") && (
                  <a href="/business/business-value">
                    <NavIcon name="business-value" />
                    Business Value
                  </a>
                )}
              </NavSection>

              <NavSection
                storageKey="business-act"
                label="Act"
                hrefs={[
                  "/business/attention-centre",
                  "/business/cases",
                  "/business/improvement-initiatives",
                  "/business/decision-log",
                  "/business/closing-the-loop",
                ]}
              >
                {teamMemberCanAccess(user, "attentionCentre") && (
                  <a href="/business/attention-centre">
                    <NavIcon name="attention-centre" />
                    Attention Centre
                  </a>
                )}
                {teamMemberCanAccess(user, "caseManagement") && (
                  <a href="/business/cases">
                    <NavIcon name="cases" />
                    Case Management
                  </a>
                )}
                {hasFeature(business.enabledFeatures, "improvementInitiatives") &&
                  teamMemberCanAccess(user, "improvementInitiatives") && (
                    <a href="/business/improvement-initiatives">
                      <NavIcon name="improvement-initiatives" />
                      Improvement Initiatives
                    </a>
                  )}
                {hasFeature(business.enabledFeatures, "decisionLog") && teamMemberCanAccess(user, "decisionLog") && (
                  <a href="/business/decision-log">
                    <NavIcon name="decision-log" />
                    Decision Log
                  </a>
                )}
                {hasProduct(business, "colleague_experience") &&
                  hasFeature(business.enabledFeatures, "closingLoop") &&
                  teamMemberCanAccess(user, "closingLoop") && (
                    <a href="/business/closing-the-loop">
                      <NavIcon name="closing-loop" />
                      Closing the Loop
                    </a>
                  )}
              </NavSection>

              {(() => {
                const showCxPulse =
                  cxPulseNavProduct === "customer_experience"
                    ? hasProduct(business, "customer_experience") && hasFeature(business.enabledFeatures, "cxPulse") && teamMemberCanAccess(user, "cxPulse")
                    : hasProduct(business, "colleague_experience") && teamMemberCanAccess(user, "exPulse");
                const cxPulseHref = cxPulseNavProduct === "customer_experience" ? "/business/cx-pulse" : "/business/ex-pulse";
                const cxPulseNavLabel = cxPulseNavProduct === "customer_experience" ? "CX Pulse" : "Colleague Pulse";
                // A branch's CX↔EX correlation lives on its parent org's
                // Group portal, not here — see api/business/cx-ex-correlation
                // for the same split already used for Decision Log.
                const showCorrelation = bothProductsEnabled && !isBranch && teamMemberCanAccess(user, "cxExCorrelation");
                if (!showCxPulse && !showCorrelation) return null;
                return (
                  <NavSection
                    storageKey="business-measure"
                    label="Measure"
                    defaultOpen={false}
                    hrefs={[cxPulseHref, "/business/cx-ex-correlation"]}
                  >
                    {showCxPulse && (
                      <a href={cxPulseHref}>
                        <NavIcon name="pulse" />
                        {cxPulseNavLabel}
                      </a>
                    )}
                    {showCorrelation && (
                      <a href="/business/cx-ex-correlation">
                        <NavIcon name="correlation" />
                        CX ↔ EX Correlation
                      </a>
                    )}
                  </NavSection>
                );
              })()}

              <NavSection
                storageKey="business-admin"
                label="Admin"
                defaultOpen={false}
                hrefs={[
                  "/business/team-members",
                  "/business/support",
                  "/business/billing",
                  "/business/playbooks",
                  "/business/security",
                ]}
              >
                {!isBusinessTeamMember && (
                  <a href="/business/team-members">
                    <NavIcon name="team-members" />
                    Team Members
                  </a>
                )}
                {teamMemberCanAccess(user, "support") && (
                  <a href="/business/support">
                    <NavIcon name="support" />
                    Support
                  </a>
                )}
                {!isBusinessTeamMember && (
                  <a href="/business/billing">
                    <NavIcon name="billing" />
                    Billing
                  </a>
                )}
                {hasFeature(business.enabledFeatures, "playbooks") && teamMemberCanAccess(user, "playbooks") && (
                  <a href="/business/playbooks">
                    <NavIcon name="playbooks" />
                    Playbook Library
                  </a>
                )}
                <a href="/business/security">
                  <NavIcon name="security" />
                  Security
                </a>
              </NavSection>
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
          <LogoutLink />
        </div>
      </aside>
      <main className="admin-main">
        {isGated ? (
          <BillingLockedScreen
            billingHref="/business/billing"
            status={billingStatus === "never_activated" ? "never_activated" : "lapsed"}
          />
        ) : isAccessDenied(pathname, user, isBusinessTeamMember, isLimitedTeamMember, BUSINESS_ACCESS_CONFIG) ? (
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
