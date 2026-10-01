import { describe, it, expect } from "vitest";
import { renderQuestionText, DEFAULT_INDUSTRY_CONTENT, SEED_INDUSTRY_CONTENT_PACKS } from "./industryContent";
import { COMPASS_QUESTION_BANK, questionsForProducts } from "./questionBank";

describe("renderQuestionText", () => {
  it("interpolates every {{token}} in a question against the given content pack", () => {
    const template = COMPASS_QUESTION_BANK.find((q) => q.key === "numbers_1")!.text;
    const rendered = renderQuestionText(template, SEED_INDUSTRY_CONTENT_PACKS.Banking);
    expect(rendered).not.toContain("{{");
    expect(rendered).toContain("account churn");
  });

  it("never leaves an unfilled token when falling back to the neutral default pack", () => {
    for (const q of COMPASS_QUESTION_BANK) {
      const rendered = renderQuestionText(q.text, DEFAULT_INDUSTRY_CONTENT);
      expect(rendered).not.toContain("{{");
    }
  });

  it("has a real, distinct pack for all 7 confirmed launch industries", () => {
    const expected = ["Banking", "Education", "Restaurant", "Healthcare", "Aviation", "Telecommunications", "Community Development & Training"];
    expect(Object.keys(SEED_INDUSTRY_CONTENT_PACKS).sort()).toEqual(expected.sort());
    for (const industry of expected) {
      const pack = SEED_INDUSTRY_CONTENT_PACKS[industry];
      expect(pack.numbersOutcomeExamples.length).toBeGreaterThan(0);
      expect(pack.hearingChannelExamples.length).toBeGreaterThan(0);
      expect(pack.ownershipRoleExamples.length).toBeGreaterThan(0);
    }
  });
});

describe("questionsForProducts", () => {
  it("includes only shared questions for an account with neither product (defensive default)", () => {
    const qs = questionsForProducts([]);
    expect(qs.every((q) => q.variant === "shared")).toBe(true);
  });

  it("includes shared + cx questions for a Customer-Experience-only account", () => {
    const qs = questionsForProducts(["customer_experience"]);
    expect(qs.some((q) => q.variant === "cx")).toBe(true);
    expect(qs.some((q) => q.variant === "ex")).toBe(false);
  });

  it("includes both flavors for a dual-product account", () => {
    const qs = questionsForProducts(["customer_experience", "colleague_experience"]);
    expect(qs.some((q) => q.variant === "cx")).toBe(true);
    expect(qs.some((q) => q.variant === "ex")).toBe(true);
  });
});
