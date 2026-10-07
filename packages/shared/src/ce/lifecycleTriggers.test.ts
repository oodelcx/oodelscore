import { describe, expect, it } from "vitest";
import { onboardingDueWindow, ONBOARDING_GRACE_DAYS } from "./lifecycleTriggers";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-06-30T12:00:00Z");

function isDue(startedDaysAgo: number, stageDays: number): boolean {
  const start = new Date(now.getTime() - startedDaysAgo * DAY);
  const { from, to } = onboardingDueWindow(stageDays, now);
  return start >= from && start <= to;
}

describe("onboarding due window", () => {
  it("sends the 30-day check-in on day 30", () => expect(isDue(30, 30)).toBe(true));
  it("not before day 30", () => expect(isDue(29, 30)).toBe(false));
  it("still sends if the cron missed a few days", () => expect(isDue(30 + ONBOARDING_GRACE_DAYS - 1, 30)).toBe(true));
  it("does NOT send to long-serving staff (start date 400 days ago)", () => {
    expect(isDue(400, 30)).toBe(false);
    expect(isDue(400, 90)).toBe(false);
  });
  it("does not send the 90-day check-in to someone 60 days in", () => expect(isDue(60, 90)).toBe(false));
});

import { milestoneDate } from "./lifecycleTriggers";
describe("milestoneDate", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  it("day 30 is start + 30 days", () => expect(milestoneDate("onboarding_30", { startDate: start, endDate: null }).toISOString()).toBe("2026-01-31T00:00:00.000Z"));
  it("day 90 is start + 90 days", () => expect(milestoneDate("onboarding_90", { startDate: start, endDate: null }).toISOString()).toBe("2026-04-01T00:00:00.000Z"));
  it("exit is the end date", () => expect(milestoneDate("exit", { startDate: start, endDate: new Date("2026-03-05T00:00:00Z") }).toISOString()).toBe("2026-03-05T00:00:00.000Z"));
});
