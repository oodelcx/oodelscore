import { describe, it, expect } from "vitest";
import { pearson, spearman, summariseCorrelation, regress, residualSigma, quadrantOf, laggedCorrelation, staffConceptOf, customerConceptOf, linkPainPoints, confidenceForBranches } from "./storyStats";

describe("correlation", () => {
  it("is 1 for a perfect line and -1 for a perfect inverse", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
  });
  it("returns null with too few points or no variance", () => {
    expect(pearson([1, 2], [1, 2])).toBeNull();
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });
  it("spearman handles ties and a monotonic non-linear link", () => {
    expect(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 100])).toBeCloseTo(1);
    expect(spearman([1, 1, 2, 3], [5, 5, 6, 7])).toBeCloseTo(1);
  });
  it("summary labels strength, interval and confidence", () => {
    const pts = Array.from({ length: 14 }, (_, i) => ({ x: i * 5 - 30, y: 2 + i * 0.15 + (i % 2 ? 0.05 : -0.05) }));
    const s = summariseCorrelation(pts);
    expect(s.strength).toBe("strong");
    expect(s.direction).toBe("positive");
    expect(s.confidence).toBe("directional");
    expect(s.distinguishableFromZero).toBe(true);
    expect(s.ci![0]).toBeLessThan(s.r!);
  });
  it("labels sample size honestly", () => {
    expect(confidenceForBranches(8)).toBe("insufficient");
    expect(confidenceForBranches(12)).toBe("directional");
    expect(confidenceForBranches(30)).toBe("reasonable");
  });
});

describe("regression and outliers", () => {
  const pts = [{ x: -20, y: 2.6 }, { x: -10, y: 3 }, { x: 0, y: 3.4 }, { x: 10, y: 3.9 }, { x: 20, y: 4.2 }, { x: 30, y: 4.6 }];
  it("flags a branch whose customers are far worse than staff predict", () => {
    const reg = regress(pts)!;
    expect(reg.slope).toBeGreaterThan(0);
    const sigma = residualSigma({ x: 30, y: 3.2 }, reg)!;
    expect(sigma).toBeLessThan(-1);
  });
  it("needs five branches", () => expect(regress(pts.slice(0, 4))).toBeNull());
});

describe("quadrants", () => {
  it("classifies each corner and skips missing data", () => {
    expect(quadrantOf(3, -10)).toBe("both_low");
    expect(quadrantOf(4.2, -10)).toBe("staff_low");
    expect(quadrantOf(3, 20)).toBe("customer_low");
    expect(quadrantOf(4.2, 20)).toBe("both_ok");
    expect(quadrantOf(null, 20)).toBeNull();
  });
});

describe("lag", () => {
  it("finds staff leading customers by two weeks", () => {
    const staff = [10, 5, 0, -5, -10, -5, 0, 5, 10, 15, 5, -5, -10, 0];
    const customer = [null, null, ...staff.slice(0, 12).map((s) => 4 + s / 20)];
    const r = laggedCorrelation(staff, customer)!;
    expect(r.bestLagWeeks).toBe(2);
    expect(r.staffLeads).toBe(true);
  });
  it("returns null without enough paired weeks", () => expect(laggedCorrelation([1, 2, 3], [1, 2, 3])).toBeNull());
});

describe("linking themes", () => {
  it("maps seeded and free-text themes to concepts", () => {
    expect(staffConceptOf("scheduling")).toBe("workload");
    expect(staffConceptOf("manager support")).toBe("leadership");
    expect(staffConceptOf("training")).toBe("development");
    expect(customerConceptOf("wait time")).toBe("speed");
    expect(customerConceptOf("staff attitude")).toBe("courtesy");
    expect(customerConceptOf("restroom cleanliness")).toBe("cleanliness");
    expect(staffConceptOf("something else entirely")).toBeNull();
  });
  it("only links when both sides have enough negative mentions, strongest first", () => {
    const staff = new Map([["workload" as const, { negative: 6, total: 9 }], ["morale" as const, { negative: 2, total: 5 }]]);
    const cust = new Map([["speed" as const, { negative: 8, total: 12 }], ["courtesy" as const, { negative: 4, total: 9 }]]);
    const links = linkPainPoints(staff, cust);
    expect(links[0]).toMatchObject({ staff: "workload", customer: "speed" });
    expect(links.some((l) => l.staff === "morale")).toBe(false);
  });
});
