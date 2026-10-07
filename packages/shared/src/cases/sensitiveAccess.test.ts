import { describe, expect, it } from "vitest";
import { canViewCase, sensitiveVisibilityClause } from "./sensitiveAccess";

const contact = { userId: "u-contact", seesUnassignedSensitive: false };
const branchOwner = { userId: "u-branch", seesUnassignedSensitive: false };
const groupOwner = { userId: "u-group", seesUnassignedSensitive: true };
const idOf = (s: string) => ({ toString: () => s });

describe("canViewCase", () => {
  it("anyone sees a normal case", () => expect(canViewCase({ sensitive: false, ownerId: null }, branchOwner)).toBe(true));
  it("the assigned contact sees a sensitive case", () => expect(canViewCase({ sensitive: true, ownerId: idOf("u-contact") }, contact)).toBe(true));
  it("a branch owner does NOT see a sensitive case assigned to someone else", () => expect(canViewCase({ sensitive: true, ownerId: idOf("u-contact") }, branchOwner)).toBe(false));
  it("a branch owner does NOT see an unassigned sensitive case", () => expect(canViewCase({ sensitive: true, ownerId: null }, branchOwner)).toBe(false));
  it("the group top owner sees an unassigned sensitive case", () => expect(canViewCase({ sensitive: true, ownerId: null }, groupOwner)).toBe(true));
  it("the group top owner does NOT see one assigned to a different contact", () => expect(canViewCase({ sensitive: true, ownerId: idOf("u-contact") }, groupOwner)).toBe(false));
});

describe("sensitiveVisibilityClause", () => {
  it("includes unassigned only for the top owner", () => {
    expect(JSON.stringify(sensitiveVisibilityClause(groupOwner))).toContain('"ownerId":null');
    expect(JSON.stringify(sensitiveVisibilityClause(branchOwner))).not.toContain('"ownerId":null');
  });
});
