import { describe, it, expect } from "vitest";
import { isAccessDenied, BUSINESS_ACCESS_CONFIG, GROUP_ACCESS_CONFIG, type AccessCheckUser } from "./routeAccess";

const owner: AccessCheckUser = { accountType: "business", tier: null };

const fullTeamMember: AccessCheckUser = { accountType: "team_member", tier: "full", restrictedPages: [] };
const limitedTeamMember: AccessCheckUser = { accountType: "team_member", tier: "limited" };
const restrictedTeamMember: AccessCheckUser = {
  accountType: "team_member",
  tier: "full",
  restrictedPages: ["insights"],
};

describe("isAccessDenied — Business portal", () => {
  it("never denies the primary owner, anywhere", () => {
    for (const path of ["/business", "/business/billing", "/business/team-members", "/business/insights"]) {
      expect(isAccessDenied(path, owner, false, false, BUSINESS_ACCESS_CONFIG)).toBe(false);
    }
  });

  it("denies a Limited-tier team member on every owner-only route and the dashboard root — the exact bug this regression-guards", () => {
    const deniedPaths = ["/business", "/business/billing", "/business/team-members", "/business/category-owners"];
    for (const path of deniedPaths) {
      expect(isAccessDenied(path, limitedTeamMember, true, true, BUSINESS_ACCESS_CONFIG)).toBe(true);
    }
  });

  it("denies a Limited-tier team member on every TeamPageKey route too, since teamMemberCanAccess restricts limited tier to caseManagement only", () => {
    expect(isAccessDenied("/business/insights", limitedTeamMember, true, true, BUSINESS_ACCESS_CONFIG)).toBe(true);
    expect(isAccessDenied("/business/cases", limitedTeamMember, true, true, BUSINESS_ACCESS_CONFIG)).toBe(false);
  });

  it("allows a full-tier team member on the dashboard root and any non-restricted page", () => {
    expect(isAccessDenied("/business", fullTeamMember, true, false, BUSINESS_ACCESS_CONFIG)).toBe(false);
    expect(isAccessDenied("/business/insights", fullTeamMember, true, false, BUSINESS_ACCESS_CONFIG)).toBe(false);
  });

  it("still denies a full-tier team member on the three true owner-only routes", () => {
    for (const path of ["/business/billing", "/business/team-members", "/business/category-owners"]) {
      expect(isAccessDenied(path, fullTeamMember, true, false, BUSINESS_ACCESS_CONFIG)).toBe(true);
    }
  });

  it("denies a full-tier team member on a page explicitly in their restrictedPages", () => {
    expect(isAccessDenied("/business/insights", restrictedTeamMember, true, false, BUSINESS_ACCESS_CONFIG)).toBe(true);
  });

  it("denies on a nested sub-path of an owner-only route, not just the exact path", () => {
    expect(isAccessDenied("/business/billing/history", limitedTeamMember, true, true, BUSINESS_ACCESS_CONFIG)).toBe(true);
  });

  it("does not deny an unmapped route (nothing to check — e.g. a future page not yet wired in)", () => {
    expect(isAccessDenied("/business/some-new-page", fullTeamMember, true, false, BUSINESS_ACCESS_CONFIG)).toBe(false);
  });

  it("every route in the Alerts feed (the newest addition) is covered by the config, not silently unmapped", () => {
    expect(BUSINESS_ACCESS_CONFIG.pageAccessKeys.some(([prefix]) => prefix === "/business/alerts")).toBe(true);
  });
});

describe("isAccessDenied — Group portal", () => {
  it("never denies the primary org owner, anywhere", () => {
    for (const path of ["/group", "/group/billing", "/group/team-members", "/group/insights"]) {
      expect(isAccessDenied(path, owner, false, false, GROUP_ACCESS_CONFIG)).toBe(false);
    }
  });

  it("denies a Limited-tier org team member on the dashboard root and every owner-only route", () => {
    for (const path of ["/group", "/group/billing", "/group/team-members", "/group/category-owners"]) {
      expect(isAccessDenied(path, limitedTeamMember, true, true, GROUP_ACCESS_CONFIG)).toBe(true);
    }
  });

  it("allows a full-tier ('full access') org team member to see the Organisation Overview — this is intentional, not the bug QA flagged on PR #166", () => {
    expect(isAccessDenied("/group", fullTeamMember, true, false, GROUP_ACCESS_CONFIG)).toBe(false);
  });

  it("still denies a full-tier org team member on the three true owner-only routes", () => {
    for (const path of ["/group/billing", "/group/team-members", "/group/category-owners"]) {
      expect(isAccessDenied(path, fullTeamMember, true, false, GROUP_ACCESS_CONFIG)).toBe(true);
    }
  });

  it("every route in the Alerts feed is covered by the config, not silently unmapped", () => {
    expect(GROUP_ACCESS_CONFIG.pageAccessKeys.some(([prefix]) => prefix === "/group/alerts")).toBe(true);
  });
});
