import { describe, expect, it } from "vitest";
import { maskBusinessMetricsForAnonymity } from "./anonymityMask";
import type { BusinessMetrics } from "./aggregate";

const base = (responseCount: number): BusinessMetrics => ({
  responseCount,
  starAverage: 4.2,
  npsScore: 30,
  csatPercent: 80,
  cesAverage: 2,
  cesLowEffortPercent: 70,
  starCount: responseCount,
  npsCount: responseCount,
  csatCount: responseCount,
  cesCount: responseCount,
});

describe("maskBusinessMetricsForAnonymity", () => {
  it("hides every score for a colleague location with 4 responses but keeps the count", () => {
    const out = maskBusinessMetricsForAnonymity(base(4), "colleague_experience");
    expect(out.responseCount).toBe(4);
    expect(out.starAverage).toBeNull();
    expect(out.npsScore).toBeNull();
    expect(out.csatPercent).toBeNull();
    expect(out.cesLowEffortPercent).toBeNull();
  });
  it("shows scores at exactly 5 responses", () => {
    const out = maskBusinessMetricsForAnonymity(base(5), "colleague_experience");
    expect(out.starAverage).toBe(4.2);
    expect(out.npsScore).toBe(30);
  });
  it("never masks the customer product", () => {
    const out = maskBusinessMetricsForAnonymity(base(1), "customer_experience");
    expect(out.starAverage).toBe(4.2);
  });
});
