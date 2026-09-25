/**
 * Per-person page access for Business/Group Team Members. Separate from
 * features/flags.ts (that's account-level: which advanced features the
 * whole account has), this is one level down: within an account's own
 * enabled features, which of them a specific "full" tier person can see.
 * "Limited" tier is unaffected — it's already locked to Case Management
 * only, regardless of this list.
 */
export const TEAM_RESTRICTABLE_PAGES = [
  { key: "caseManagement", label: "Case Management" },
  { key: "rawFeedback", label: "Raw Feedback" },
  { key: "feedbackPoints", label: "Feedback Points" },
  { key: "insights", label: "Insights" },
  { key: "analytics", label: "Analytics" },
  { key: "alertRules", label: "Alert Rules" },
  { key: "alerts", label: "Alerts" },
  { key: "reports", label: "Reports" },
  { key: "improvementInitiatives", label: "Improvement Initiatives" },
  { key: "decisionLog", label: "Decision Log" },
  { key: "cxPulse", label: "CX Pulse" },
  { key: "playbooks", label: "Playbook Library" },
  { key: "support", label: "Support" },
  { key: "colleagueRoster", label: "Colleague Roster" },
  { key: "exPulse", label: "EX Pulse" },
  { key: "cxExCorrelation", label: "CX ↔ EX Correlation" },
] as const;

export type TeamPageKey = (typeof TEAM_RESTRICTABLE_PAGES)[number]["key"];

const TEAM_PAGE_KEY_SET: ReadonlySet<string> = new Set(TEAM_RESTRICTABLE_PAGES.map((p) => p.key));

export function isValidTeamPageKey(key: string): key is TeamPageKey {
  return TEAM_PAGE_KEY_SET.has(key);
}

/**
 * Whether this person can see a given page. Always true for the primary
 * owner (accountType !== "team_member"). "limited" tier can only ever see
 * Case Management (their own assigned cases), regardless of restrictedPages.
 * "full" tier sees everything except whatever's explicitly restricted.
 */
export function teamMemberCanAccess(
  user: { accountType: string; tier: string | null; restrictedPages?: string[] | null },
  pageKey: TeamPageKey
): boolean {
  if (user.accountType !== "team_member") return true;
  if (user.tier === "limited") return pageKey === "caseManagement";
  return !(user.restrictedPages ?? []).includes(pageKey);
}
