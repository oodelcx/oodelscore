import { describe, it, expect } from "vitest";
import { computeDimensionScore, computeCompassResult, type CompassAnswerInput } from "./scoring";
import { ANCHOR_DIMENSIONS } from "./questionBank";

function answer(dimension: CompassAnswerInput["dimension"], value: CompassAnswerInput["value"], key = `${dimension}_x`): CompassAnswerInput {
  return { questionKey: key, dimension, value };
}

describe("computeDimensionScore", () => {
  it("is the MIN of the dimension's answers, not the average", () => {
    const answers = [answer("hearing", 3, "hearing_1"), answer("hearing", 0, "hearing_2")];
    expect(computeDimensionScore(answers, "hearing").score).toBe(0);
  });

  it("returns 0 for a dimension with no answers, without throwing", () => {
    const result = computeDimensionScore([], "authority");
    expect(result.score).toBe(0);
    expect(result.answerCount).toBe(0);
  });

  it("ignores answers from other dimensions", () => {
    const answers = [answer("authority", 1), answer("numbers", 3)];
    expect(computeDimensionScore(answers, "numbers").score).toBe(3);
  });
});

describe("computeCompassResult", () => {
  const allDimensionsAt = (value: 0 | 1 | 2 | 3): CompassAnswerInput[] => ANCHOR_DIMENSIONS.map((d) => answer(d, value));

  it("gates the overall stage on the MIN dimension score, not the average", () => {
    // Five dimensions strong (3), one dimension weak (1) -> still Emerging.
    const answers = allDimensionsAt(3).filter((a) => a.dimension !== "authority");
    answers.push(answer("authority", 1));
    const result = computeCompassResult(answers);
    expect(result.overallScore).toBe(1);
    expect(result.stage).toBe("emerging");
    expect(result.gatingDimensions).toEqual(["authority"]);
  });

  it("is Established only when every dimension scores >= 2", () => {
    const result = computeCompassResult(allDimensionsAt(2));
    expect(result.stage).toBe("established");
    expect(result.gatingDimensions).toEqual([]);
  });

  it("is Emerging when every dimension is exactly one point short", () => {
    const result = computeCompassResult(allDimensionsAt(1));
    expect(result.stage).toBe("emerging");
    expect(result.gatingDimensions).toEqual([...ANCHOR_DIMENSIONS]);
  });

  it("treats a completely unanswered assessment as Emerging, not a crash", () => {
    const result = computeCompassResult([]);
    expect(result.overallScore).toBe(0);
    expect(result.stage).toBe("emerging");
    expect(result.index).toBe(0);
  });

  it("computes the trend-only index as a 0-100 weighted average, independent of the gate", () => {
    // All dimensions at 3 (max) -> index 100, regardless of stage logic.
    expect(computeCompassResult(allDimensionsAt(3)).index).toBe(100);
    // All dimensions at 0 -> index 0.
    expect(computeCompassResult(allDimensionsAt(0)).index).toBe(0);
    // Half strength across the board -> index ~50.
    const half = computeCompassResult(allDimensionsAt(1)).index;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(100);
  });

  it("scores every one of the six ANCHOR dimensions even when only some are answered", () => {
    const result = computeCompassResult([answer("rhythm", 3)]);
    expect(result.dimensionScores).toHaveLength(6);
    expect(result.dimensionScores.map((d) => d.dimension)).toEqual([...ANCHOR_DIMENSIONS]);
  });
});
