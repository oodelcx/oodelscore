import { describe, expect, it } from "vitest";
import { visibleIndustries, mergeIndustries } from "./industries";

describe("sector visibility", () => {
  it("shows every default sector when nothing is stored", () => {
    expect(visibleIndustries(undefined).length).toBeGreaterThanOrEqual(8);
  });

  it("hides a sector the admin switched off, and keeps the rest", () => {
    const stored = JSON.stringify([
      { slug: "banking", name: "Banking & Finance" },
      { slug: "telecom", name: "Telecom", visible: "no" },
    ]);
    expect(mergeIndustries(stored)).toHaveLength(2);
    expect(visibleIndustries(stored).map((i) => i.slug)).toEqual(["banking"]);
  });

  it("treats a missing or 'yes' value as shown", () => {
    const stored = JSON.stringify([{ slug: "retail", name: "Retail", visible: "yes" }, { slug: "banking", name: "Banking" }]);
    expect(visibleIndustries(stored)).toHaveLength(2);
  });
});

describe("sector lists saved as text", () => {
  it("turns JSON text lists back into arrays", () => {
    const stored = JSON.stringify([{ slug: "retail", name: "Retail", cxMeasures: '["Queues","Stock"]', cxUses: "not json" }]);
    const [retail] = mergeIndustries(stored);
    expect(retail.cxMeasures).toEqual(["Queues", "Stock"]);
    expect(Array.isArray(retail.cxUses)).toBe(true);
  });
});
