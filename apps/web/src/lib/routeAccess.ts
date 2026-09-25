import { teamMemberCanAccess, type TeamPageKey } from "@oodelscore/shared";

export interface AccessCheckUser {
  accountType: string;
  tier: string | null;
  teamOfType?: string | null;
  restrictedPages?: string[] | null;
}

/**
 * Single source of truth for "does this URL 403 for this session" on the
 * Business and Group portals, used by both the layouts (to render
 * AccessDenied) and by routeAccess.test.ts (to regression-guard it without
 * needing a browser or a database). Previously this logic was duplicated
 * inline in each layout.tsx — which is exactly how the AccessDenied gap
 * happened: a route present in the nav's visibility guards but absent from
 * the separate PAGE_ACCESS_KEYS/OWNER_ONLY_ROUTES lists silently fell
 * through with nothing to check. Keeping one array per portal and testing
 * every route this app actually serves against it is cheaper than
 * re-discovering the same class of bug by hand again.
 */
export interface PortalAccessConfig {
  /** Route prefix -> TeamPageKey. Longest-prefix match via `.find()` order
   * doesn't matter here since no two prefixes in either portal overlap. */
  pageAccessKeys: [string, TeamPageKey][];
  /** Routes with no TeamPageKey at all — never shown to a team member of
   * any tier, so they can't be represented as a togglable permission. */
  ownerOnlyRoutes: string[];
  /** The portal's dashboard root ("/business" or "/group" exactly) — shown
   * to non-limited team members but not Limited tier, so it needs its own
   * check distinct from both the TeamPageKey list and OWNER_ONLY_ROUTES. */
  dashboardRoot: string;
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function pageKeyForPath(pathname: string, config: PortalAccessConfig): TeamPageKey | null {
  const match = config.pageAccessKeys.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1] : null;
}

/**
 * True when `pathname` should render AccessDenied for `user` under this
 * portal's config. `isTeamMember` / `isLimited` are passed in rather than
 * derived here since the two portals compute "is this session a team
 * member of this portal at all" differently (business: teamOfType ===
 * "business"; group: teamOfType === "parentOrg") — that distinction stays
 * in the layout, this function only needs the yes/no answer.
 */
export function isAccessDenied(
  pathname: string,
  user: AccessCheckUser,
  isTeamMember: boolean,
  isLimited: boolean,
  config: PortalAccessConfig
): boolean {
  if (isTeamMember && matchesPrefix(pathname, config.ownerOnlyRoutes)) return true;
  if (isLimited && pathname === config.dashboardRoot) return true;
  const pageKey = pageKeyForPath(pathname, config);
  return !!pageKey && !teamMemberCanAccess(user, pageKey);
}

export const BUSINESS_ACCESS_CONFIG: PortalAccessConfig = {
  dashboardRoot: "/business",
  ownerOnlyRoutes: ["/business/billing", "/business/team-members", "/business/category-owners"],
  pageAccessKeys: [
    ["/business/feedback-points", "feedbackPoints"],
    ["/business/roster", "colleagueRoster"],
    ["/business/responses", "rawFeedback"],
    ["/business/insights", "insights"],
    ["/business/analytics", "analytics"],
    ["/business/alert-rules", "alertRules"],
    ["/business/alerts", "alerts"],
    ["/business/reports", "reports"],
    ["/business/improvement-initiatives", "improvementInitiatives"],
    ["/business/decision-log", "decisionLog"],
    ["/business/cx-pulse", "cxPulse"],
    ["/business/ex-pulse", "exPulse"],
    ["/business/cx-ex-correlation", "cxExCorrelation"],
    ["/business/support", "support"],
    ["/business/playbooks", "playbooks"],
    ["/business/cases", "caseManagement"],
  ],
};

export const GROUP_ACCESS_CONFIG: PortalAccessConfig = {
  dashboardRoot: "/group",
  ownerOnlyRoutes: ["/group/billing", "/group/team-members", "/group/category-owners"],
  pageAccessKeys: [
    ["/group/raw-feedback", "rawFeedback"],
    ["/group/insights", "insights"],
    ["/group/analytics", "analytics"],
    ["/group/alert-rules", "alertRules"],
    ["/group/alerts", "alerts"],
    ["/group/reports", "reports"],
    ["/group/improvement-initiatives", "improvementInitiatives"],
    ["/group/decision-log", "decisionLog"],
    ["/group/maturity", "cxPulse"],
    ["/group/ex-pulse", "exPulse"],
    ["/group/cx-ex-correlation", "cxExCorrelation"],
    ["/group/playbooks", "playbooks"],
    ["/group/support", "support"],
    ["/group/cases", "caseManagement"],
  ],
};
