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
  teamMemberCanAccess,
} from "@oodelscore/shared";
import LogoutLink from "./logout-link";
import { BillingLockedScreen } from "@/components/billing-locked-screen";
import MobileNavToggle from "@/components/mobile-nav-toggle";
import { TourProvider } from "@/components/tour/tour-provider";
import { TourLauncher } from "@/components/tour/tour-launcher";
import { NavSection } from "@/components/nav-section";
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

              <NavSection
                storageKey="business-setup"
                label="Setup"
                hrefs={["/business/feedback-points", "/business/category-owners", "/business/roster"]}
              >
                {teamMemberCanAccess(user, "feedbackPoints") && <a href="/business/feedback-points">Feedback Points</a>}
                {!isBusinessTeamMember && <a href="/business/category-owners">Category Owners</a>}
                {hasProduct(business, "colleague_experience") && teamMemberCanAccess(user, "colleagueRoster") && (
                  <a href="/business/roster">Roster</a>
                )}
              </NavSection>

              <NavSection storageKey="business-listen" label="Listen" hrefs={["/business/responses"]}>
                {teamMemberCanAccess(user, "rawFeedback") && <a href="/business/responses">Raw Feedback</a>}
              </NavSection>

              <NavSection
                storageKey="business-understand"
                label="Understand"
                hrefs={["/business/insights", "/business/analytics", "/business/alert-rules", "/business/reports", "/business/ex-pulse"]}
              >
                {hasProduct(business, "customer_experience") &&
                  hasFeature(business.enabledFeatures, "insights") &&
                  teamMemberCanAccess(user, "insights") && <a href="/business/insights">Insights</a>}
                {hasProduct(business, "customer_experience") &&
                  hasFeature(business.enabledFeatures, "analytics") &&
                  teamMemberCanAccess(user, "analytics") && <a href="/business/analytics">Analytics</a>}
                {hasFeature(business.enabledFeatures, "alertRules") && teamMemberCanAccess(user, "alertRules") && (
                  <a href="/business/alert-rules">Alert Rules</a>
                )}
                {hasProduct(business, "customer_experience") &&
                  hasFeature(business.enabledFeatures, "reports") &&
                  teamMemberCanAccess(user, "reports") && <a href="/business/reports">Reports</a>}
                {hasProduct(business, "colleague_experience") && teamMemberCanAccess(user, "exPulse") && (
                  <a href="/business/ex-pulse">EX Pulse</a>
                )}
              </NavSection>

              <NavSection
                storageKey="business-act"
                label="Act"
                hrefs={["/business/cases", "/business/improvement-initiatives", "/business/decision-log"]}
              >
                {teamMemberCanAccess(user, "caseManagement") && <a href="/business/cases">Case Management</a>}
                {hasFeature(business.enabledFeatures, "improvementInitiatives") &&
                  teamMemberCanAccess(user, "improvementInitiatives") && (
                    <a href="/business/improvement-initiatives">Improvement Initiatives</a>
                  )}
                {hasFeature(business.enabledFeatures, "decisionLog") && teamMemberCanAccess(user, "decisionLog") && (
                  <a href="/business/decision-log">Decision Log</a>
                )}
              </NavSection>

              {hasProduct(business, "customer_experience") &&
                hasFeature(business.enabledFeatures, "cxPulse") &&
                teamMemberCanAccess(user, "cxPulse") && (
                  <NavSection storageKey="business-measure" label="Measure" defaultOpen={false} hrefs={["/business/cx-pulse"]}>
                    <a href="/business/cx-pulse">CX Pulse</a>
                  </NavSection>
                )}

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
                {!isBusinessTeamMember && <a href="/business/team-members">Team Members</a>}
                {teamMemberCanAccess(user, "support") && <a href="/business/support">Support</a>}
                {!isBusinessTeamMember && <a href="/business/billing">Billing</a>}
                {hasFeature(business.enabledFeatures, "playbooks") && teamMemberCanAccess(user, "playbooks") && (
                  <a href="/business/playbooks">Playbook Library</a>
                )}
                <a href="/business/security">Security</a>
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
        ) : toursEnabled ? (
          <TourProvider initialSeenTours={[...user.seenTours]}>
            <TourLauncher />
            {children}
          </TourProvider>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
