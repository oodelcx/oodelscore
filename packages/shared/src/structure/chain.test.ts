import { describe, it, expect } from "vitest";
import { buildTreeChain, chainIndexForLevel, slaHoursForStep } from "./chain";

describe("buildTreeChain", () => {
  const base = { branchTitle: "Branch manager", branchOwnerId: "b1", groupSteps: [{ title: "Group Head", userId: "g1" }], fallbackHead: null };
  it("goes branch, cluster, region, group in order and numbers the steps", () => {
    const chain = buildTreeChain({
      ...base,
      nodes: [
        { tierKey: "cluster", tierName: "Cluster", managerTitle: "Cluster Manager", managerUserId: "c1" },
        { tierKey: "region", tierName: "Region", managerTitle: "", managerUserId: "r1" },
      ],
    });
    expect(chain.map((c) => [c.level, c.label, c.userId])).toEqual([
      [1, "Branch manager", "b1"],
      [2, "Cluster Manager", "c1"],
      [3, "Region manager", "r1"],
      [4, "Group Head", "g1"],
    ]);
  });
  it("skips boxes with no manager", () => {
    const chain = buildTreeChain({ ...base, nodes: [{ tierKey: "area", tierName: "Area", managerTitle: "", managerUserId: null }] });
    expect(chain.map((c) => c.label)).toEqual(["Branch manager", "Group Head"]);
  });
  it("ends at the owner when no group steps are set", () => {
    const chain = buildTreeChain({ ...base, groupSteps: [], nodes: [], fallbackHead: { userId: "o1", title: "Group Head" } });
    expect(chain).toHaveLength(2);
    expect(chain[1].userId).toBe("o1");
  });
  it("is just the branch for a business with nobody above", () => {
    expect(buildTreeChain({ ...base, groupSteps: [], nodes: [], fallbackHead: null })).toHaveLength(1);
  });
});

describe("chainIndexForLevel", () => {
  const chain = buildTreeChain({ branchTitle: "B", branchOwnerId: "b", nodes: [], groupSteps: [{ title: "H", userId: "h" }], fallbackHead: null });
  it("finds an exact level", () => expect(chainIndexForLevel(chain, 2)).toBe(1));
  it("treats a level past the end as the top", () => expect(chainIndexForLevel(chain, 5)).toBe(1));
  it("treats level 1 as the bottom", () => expect(chainIndexForLevel(chain, 1)).toBe(0));
});

describe("slaHoursForStep", () => {
  const step = { level: 2, label: "x", userId: "u", tierKey: "cluster" };
  it("uses the step's own hours first", () => expect(slaHoursForStep(step, { cluster: 24 }, 48)).toBe(24));
  it("falls back to the single number", () => expect(slaHoursForStep(step, {}, 48)).toBe(48));
  it("is null when nothing is set", () => expect(slaHoursForStep(step, undefined, null)).toBeNull());
});
