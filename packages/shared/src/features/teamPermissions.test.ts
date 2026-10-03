import { describe, it, expect } from "vitest";
import { teamMemberCanAccess, isValidTeamPageKey, TEAM_RESTRICTABLE_PAGES } from "./teamPermissions";

describe("teamMemberCanAccess", () => {
  it("is always true for the primary owner, regardless of tier or restrictedPages", () => {
    expect(teamMemberCanAccess({ accountType: "business", tier: null }, "insights")).toBe(true);
    expect(teamMemberCanAccess({ accountType: "parent_org", tier: null, restrictedPages: ["insights"] }, "insights")).toBe(
      true
    );
  });

  it("restricts a Limited-tier team member to caseManagement only, on every other page", () => {
    const limited = { accountType: "team_member", tier: "limited" };
    expect(teamMemberCanAccess(limited, "caseManagement")).toBe(true);
    for (const page of TEAM_RESTRICTABLE_PAGES) {
      if (page.key === "caseManagement") continue;
      expect(teamMemberCanAccess(limited, page.key)).toBe(false);
    }
  });

  it("allows a full-tier team member everywhere by default (empty restrictedPages)", () => {
    const full = { accountType: "team_member", tier: "full", restrictedPages: [] };
    for (const page of TEAM_RESTRICTABLE_PAGES) {
      expect(teamMemberCanAccess(full, page.key)).toBe(true);
    }
  });

  it("allows a full-tier team member everywhere when restrictedPages is null/undefined", () => {
    expect(teamMemberCanAccess({ accountType: "team_member", tier: "full" }, "insights")).toBe(true);
    expect(teamMemberCanAccess({ accountType: "team_member", tier: "full", restrictedPages: null }, "insights")).toBe(true);
  });

  it("denies a full-tier team member exactly the pages listed in restrictedPages, nothing more", () => {
    const restricted = { accountType: "team_member", tier: "full", restrictedPages: ["insights", "reports"] };
    expect(teamMemberCanAccess(restricted, "insights")).toBe(false);
    expect(teamMemberCanAccess(restricted, "reports")).toBe(false);
    expect(teamMemberCanAccess(restricted, "analytics")).toBe(true);
  });

  it("the newly-added 'alerts' key is a valid, independently restrictable page distinct from 'alertRules'", () => {
    expect(isValidTeamPageKey("alerts")).toBe(true);
    const restrictedFromAlertsOnly = { accountType: "team_member", tier: "full", restrictedPages: ["alerts"] };
    expect(teamMemberCanAccess(restrictedFromAlertsOnly, "alerts")).toBe(false);
    expect(teamMemberCanAccess(restrictedFromAlertsOnly, "alertRules")).toBe(true);
  });
});
