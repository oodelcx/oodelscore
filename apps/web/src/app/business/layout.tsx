import { hideColleagueFromBranch } from "@/lib/ownerAuth";
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
  businessValueInputsComplete,
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
import "../portal-refresh.css";

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isPrimaryOwner = user.accountType === "business";
  const isBusinessTeamMember = user.accountType === "team_member" && user.teamOfType === "business";
  if (!isPrimaryOwner && !isBusinessTeamMember) redirect("/dashboard");

  await connectToDatabase();
  const business = await Business.findById(user.parentId);
  if (!business) redirect("/login");
  hideColleagueFromBranch(business);

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
  // Single-product-only nav items (Roster is CE-only; Insights/Analytics/
  // Reports/Closing the Loop are CX- or CE-only) must also respect which
  // tab is actually active on a dual-product account — hasProduct() alone
  // only says the account has that product at all, so without this a
  // Colleague-only page like Roster kept showing while viewing the
  // Customer Experience tab.
  const showCx = !bothProductsEnabled || viewProduct === "customer_experience";
  const showCe = !bothProductsEnabled || viewProduct === "colleague_experience";
  // Business Value doesn't apply the same way to every account (a school
  // run by a local authority has no "cost to acquire a customer"), so
  // nobody but the top account should see the menu until it's actually
  // set up — the owner always sees it (to be the one who sets it up), a
  // branch or team member only once it's configured.
  const canEditBusinessValue = !isBusinessTeamMember && !isBranch;
  const showBusinessValue = canEditBusinessValue || businessValueInputsComplete(business.businessValueInputs);
  // A parent org can delegate Feedback Points/Category Owners/CX Goals/Alert
  // Rules down to its branches, or keep them centralized — its call, per
  // branch permission (see ParentOrganization.branchPermissions). A
  // standalone business or the top account of a group is never restricted.
  const branchPerms = parentOrg?.branchPermissions ?? { feedbackPoints: true, categoryOwners: true, cxGoals: true, alertRules: true };
  const showFeedbackPointsNav = !isBranch || branchPerms.feedbackPoints;
  const showCategoryOwnersNav = !isBranch || branchPerms.categoryOwners;
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
            <img className="admin-logo" src="/oodelcx-logo-dark.webp" alt="OodelCX" />
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
                {hasFeature(business.enabledFeatures, "compass") && teamMemberCanAccess(user, "compass") && (
                  <a href="/business/compass">
                    <NavIcon name="compass" />
                    OodelCX Compass
                  </a>
                )}
              </nav>

              <NavSection
                storageKey="business-setup"
                label="Setup"
                hrefs={["/business/feedback-points", "/business/category-owners"]}
              >
                {teamMemberCanAccess(user, "feedbackPoints") && showFeedbackPointsNav && (
                  <a href="/business/feedback-points">
                    <NavIcon name="feedback-points" />
                    Feedback Points
                  </a>
                )}
                {!isBusinessTeamMember && showCategoryOwnersNav && (
                  <a href="/business/category-owners">
                    <NavIcon name="category-owners" />
                    Category Owners
                  </a>
                )}
              </NavSection>

              <NavSection storageKey="business-capture" label="Capture" hrefs={["/business/responses"]}>
                {teamMemberCanAccess(user, "rawFeedback") && (
                  <a href="/business/responses">
                    <NavIcon name="raw-feedback" />
                    Raw Feedback
                  </a>
                )}
              </NavSection>

              <NavSection
                storageKey="business-clarify"
                label="Clarify"
                hrefs={[
                  "/business/insights",
                  "/business/analytics",
                  "/business/highlights",
                  "/business/alert-rules",
                  "/business/alerts",
                  "/business/business-value",
                  "/business/program-evaluation",
                ]}
              >
                {hasProduct(business, "customer_experience") &&
                  showCx &&
                  hasFeature(business.enabledFeatures, "insights") &&
                  teamMemberCanAccess(user, "insights") && (
                    <a href="/business/insights">
                      <NavIcon name="insights" />
                      Insights
                    </a>
                  )}
                {hasFeature(business.enabledFeatures, "highlights") && teamMemberCanAccess(user, "highlights") && (
                  <a href="/business/highlights">
                    <NavIcon name="insights" />
                    Highlights
                  </a>
                )}
                {hasProduct(business, "customer_experience") &&
                  showCx &&
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
                  showCx &&
                  hasFeature(business.enabledFeatures, "businessValue") &&
                  teamMemberCanAccess(user, "businessValue") &&
                  showBusinessValue && (
                  <a href="/business/business-value">
                    <NavIcon name="business-value" />
                    Business Value
                  </a>
                )}
                {hasProduct(business, "customer_experience") &&
                  showCx &&
                  hasFeature(business.enabledFeatures, "programEvaluation") &&
                  teamMemberCanAccess(user, "programEvaluation") && (
                  <a href="/business/program-evaluation">
                    <NavIcon name="program-evaluation" />
                    Program Evaluation
                  </a>
                )}
              </NavSection>

              <NavSection
                storageKey="business-claim"
                label="Claim"
                hrefs={["/business/attention-centre", "/business/cases"]}
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
              </NavSection>

              <NavSection
                storageKey="business-close"
                label="Close"
                hrefs={["/business/improvement-initiatives", "/business/decision-log", "/business/closing-the-loop"]}
              >
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
                    storageKey="business-confirm"
                    label="Confirm"
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
                  "/business/escalation",
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
                {!isBusinessTeamMember && !isBranch && (
                  <a href="/business/escalation">
                    <NavIcon name="escalation" />
                    Escalation hierarchy
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
        {isBranch && (business.enabledProducts ?? []).length === 0 ? (
          <div className="card" style={{ maxWidth: 560 }}>
            <h3>Nothing to show here</h3>
            <p className="card-sub">
              {parentOrg!.name} manages staff feedback centrally. Ask your group administrator if you need access to anything.
            </p>
          </div>
        ) : isGated ? (
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
