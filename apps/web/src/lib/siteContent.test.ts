import { describe, it, expect } from "vitest";
import { mergeFields, mergeNavItems } from "./siteContent";
import type { INavItem } from "@oodelscore/shared";

describe("mergeFields", () => {
  it("backfills a seed key entirely absent from the DB doc", () => {
    const result = mergeFields({ heroHeadline: "Real headline" }, { heroHeadline: "seed default", storyParagraphs: "[]" });
    expect(result.storyParagraphs).toBe("[]");
  });

  it("never overwrites a key the DB doc already has, even an empty string an admin deliberately cleared", () => {
    const result = mergeFields({ heroHeadline: "" }, { heroHeadline: "seed default" });
    expect(result.heroHeadline).toBe("");
  });

  it("regression: a DB doc from before company's story/belief/audience fields existed still surfaces them via seed fallback — this is the exact bug the admin listing route (api/admin/site-content/route.ts) shipped without, until it started calling this function", () => {
    const oldCompanyDoc = { heroHeadline: "We built the part every feedback tool skips.", contactEmail: "hello@oodelscore.com" };
    const currentCompanySeed = {
      heroHeadline: "We built the part every feedback tool skips.",
      contactEmail: "hello@oodelscore.com",
      storyEyebrow: "Our story",
      storyParagraphs: JSON.stringify(["para 1", "para 2"]),
      beliefsHeadline: "The rules we build against",
      beliefs: JSON.stringify([{ icon: "loop", title: "A score is not an action", body: "..." }]),
      audienceItems: JSON.stringify([{ slug: "banking", name: "Banking & Finance", body: "..." }]),
    };
    const merged = mergeFields(oldCompanyDoc, currentCompanySeed);
    expect(JSON.parse(merged.storyParagraphs)).toHaveLength(2);
    expect(JSON.parse(merged.beliefs)).toHaveLength(1);
    expect(JSON.parse(merged.audienceItems)).toHaveLength(1);
  });
});

describe("mergeNavItems", () => {
  it("backfills a seed nav key entirely absent from the DB doc, defaulting to visible", () => {
    const dbItems: INavItem[] = [{ key: "product", label: "Product", visible: true, order: 0 }];
    const seedItems: INavItem[] = [
      { key: "product", label: "Customer Experience", visible: true, order: 0 },
      { key: "how-it-works", label: "How it works", visible: true, order: 4 },
    ];
    const merged = mergeNavItems(dbItems, seedItems);
    expect(merged.find((i) => i.key === "how-it-works")).toEqual({
      key: "how-it-works",
      label: "How it works",
      visible: true,
      order: 4,
    });
  });

  it("never overwrites a key the DB doc already has, including a stale label or an explicit visible:false", () => {
    const dbItems: INavItem[] = [{ key: "product", label: "Product", visible: false, order: 0 }];
    const seedItems: INavItem[] = [{ key: "product", label: "Customer Experience", visible: true, order: 0 }];
    const merged = mergeNavItems(dbItems, seedItems);
    expect(merged).toEqual(dbItems);
  });
});
