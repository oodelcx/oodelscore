import { describe, expect, it } from "vitest";
import { buildReachCards } from "./reach";

const scores = (v: number[]) =>
  (["authority", "numbers", "culture", "hearing", "ownership", "rhythm"] as const).map((dimension, i) => ({ dimension, score: v[i] as 0 | 1 | 2 | 3 }));

describe("buildReachCards", () => {
  it("gives no card for embedded, confirmed dimensions", () => {
    const cards = buildReachCards({ dimensionScores: scores([3, 3, 3, 3, 3, 3]), evidence: null, portal: "business" });
    expect(cards).toHaveLength(0);
  });
  it("cards the weak dimensions, lowest first, with portal links", () => {
    const cards = buildReachCards({ dimensionScores: scores([3, 2, 3, 0, 3, 1]), evidence: null, portal: "group" });
    expect(cards.map((c) => c.dimension)).toEqual(["hearing", "rhythm", "numbers"]);
    expect(cards[0].connect.href).toBe("/group/feedback-points");
    expect(cards[0].priority).toBe("high");
  });
  it("flags an overstated embedded dimension", () => {
    const cards = buildReachCards({
      dimensionScores: scores([3, 3, 3, 3, 3, 3]),
      evidence: [{ dimension: "ownership", status: "overstated" }],
      portal: "business",
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].recognize).toMatch(/higher than the activity shows/);
  });
  it("uses an admin override for the text", () => {
    const cards = buildReachCards({ dimensionScores: scores([0, 3, 3, 3, 3, 3]), evidence: null, portal: "business", overrides: { "authority-gap": "Custom text" } });
    expect(cards[0].recognize).toBe("Custom text");
  });
});
