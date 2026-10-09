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

import { buildPointerChain, wouldCreateLoop, type PointerPerson } from "./chain";

const person = (id: string, title: string, to: string | null): [string, PointerPerson] => [id, { id, title, escalatesToId: to }];

describe("buildPointerChain", () => {
  const people = new Map([person("cm", "Cluster Manager", "rm"), person("rm", "Regional Manager", "ops"), person("ops", "Operations Lead", "head"), person("head", "Group Head", null)]);
  const base = { branchTitle: "Branch manager", branchOwnerId: "b1", people, head: { id: "head", title: "Group Head" } };

  it("follows pointers from the branch up to the group head", () => {
    const r = buildPointerChain({ ...base, firstPointerId: "cm" });
    expect(r.chain.map((c) => [c.level, c.label, c.userId])).toEqual([
      [1, "Branch manager", "b1"],
      [2, "Cluster Manager", "cm"],
      [3, "Regional Manager", "rm"],
      [4, "Operations Lead", "ops"],
      [5, "Group Head", "head"],
    ]);
    expect(r.issues).toEqual([]);
  });
  it("sends a branch with nobody set to the group head and flags it", () => {
    const r = buildPointerChain({ ...base, firstPointerId: null });
    expect(r.chain.map((c) => c.userId)).toEqual(["b1", "head"]);
    expect(r.issues).toEqual(["nobody_set"]);
  });
  it("falls back to the group head when the pointer is to a removed person", () => {
    const r = buildPointerChain({ ...base, firstPointerId: "gone" });
    expect(r.chain.map((c) => c.userId)).toEqual(["b1", "head"]);
    expect(r.issues).toContain("pointer_removed");
  });
  it("cuts a loop and says so", () => {
    const loop = new Map([person("a", "A", "b"), person("b", "B", "a")]);
    const r = buildPointerChain({ ...base, people: loop, firstPointerId: "a" });
    expect(r.chain.map((c) => c.userId)).toEqual(["b1", "a", "b"]);
    expect(r.issues).toContain("loop");
  });
  it("is just the branch for a standalone business with nobody set", () => {
    const r = buildPointerChain({ ...base, head: null, firstPointerId: null });
    expect(r.chain).toHaveLength(1);
  });
  it("stops at a person who escalates to nobody", () => {
    const r = buildPointerChain({ ...base, firstPointerId: "head" });
    expect(r.chain.map((c) => c.userId)).toEqual(["b1", "head"]);
  });
});

describe("wouldCreateLoop", () => {
  const map = new Map<string, string | null>([["a", "b"], ["b", "c"], ["c", null]]);
  it("detects pointing at yourself", () => expect(wouldCreateLoop("a", "a", map)).toBe(true));
  it("detects a longer loop", () => expect(wouldCreateLoop("c", "a", map)).toBe(true));
  it("allows a clean pointer", () => expect(wouldCreateLoop("a", "c", map)).toBe(false));
});
